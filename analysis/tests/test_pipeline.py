import json

import numpy as np
import pytest

import batadal_data as bd
import run_batadal_case_study as run
from synthetic import make_synthetic, write_attacks, write_files

DETECTORS = {"static_limits", "zscore_max", "isolation_forest", "hist_gradient_boosting"}


@pytest.fixture(scope="module")
def synthetic():
    return make_synthetic()


@pytest.fixture(scope="module")
def result(synthetic):
    frames, attacks = synthetic
    return run.run_case_study(frames, attacks, "synthetic")


def test_runs_and_is_deterministic(synthetic, result):
    frames, attacks = synthetic
    assert result == run.run_case_study(*make_synthetic(), "synthetic")
    assert set(result["evaluations"]["test"]["detectors"]) == DETECTORS
    assert result["limitations"] and result["protocol"]["version"] == 2


def test_supervised_reference_is_never_evaluated_on_its_training_data(result):
    train_eval = result["evaluations"]["train"]
    assert "hist_gradient_boosting" not in train_eval["detectors"]
    assert train_eval["not_evaluated"] == ["hist_gradient_boosting"]
    assert "hist_gradient_boosting" in result["evaluations"]["test"]["detectors"]


def test_counts_come_from_the_published_intervals(synthetic, result):
    _, attacks = synthetic
    for name in ("train", "test"):
        wanted = [a for a in attacks if a.dataset == name]
        ev = result["evaluations"][name]
        assert ev["attacks"] == len(wanted)
        assert ev["attack_hours"] == sum(a.duration_hours for a in wanted)
        table = ev["detectors"]["zscore_max"]["per_attack"]
        assert [row["attack"] for row in table] == [a.id for a in wanted]
        assert [row["duration_hours"] for row in table] == [a.duration_hours for a in wanted]


def test_a_threshold_on_the_constant_floor_does_not_mean_a_permanent_alarm(result):
    """Regression for the first real-data run: static limits score 0 inside the range, so its
    calibrated threshold is 0.0; alarming on `>=` made it alarm 100 % of the time and look perfect."""
    for name in ("test", "train"):
        detector = result["evaluations"][name]["detectors"]["static_limits"]
        assert detector["threshold"] == 0.0
        assert detector["event"]["false_alarm_hour_fraction"] < 0.1
        assert detector["event"]["alarm_fraction"] < 0.9


def test_every_detector_reports_false_alarm_hours_and_the_chance_baseline(result):
    for name in ("test", "train"):
        for det in result["evaluations"][name]["detectors"].values():
            event = det["event"]
            assert 0.0 <= event["false_alarm_hour_fraction"] <= 1.0
            assert 0.0 <= event["expected_events_detected_by_chance"] <= event["n_events"]


def test_big_synthetic_attacks_are_caught_by_the_unsupervised_baselines(result):
    for name in ("static_limits", "zscore_max", "isolation_forest"):
        event = result["evaluations"]["test"]["detectors"][name]["event"]
        assert event["events_detected"] >= 2, name


def test_a_feature_that_is_constant_in_the_reference_still_counts(synthetic):
    """The 'pump' attack only moves a feature that is constant in the reference."""
    frames, attacks = synthetic
    out = run.run_case_study(frames, attacks, "x")
    pump = next(a for a in attacks if a.dataset == "test" and a.description.endswith("pump attack"))
    for name in ("static_limits", "zscore_max"):
        row = next(
            r
            for r in out["evaluations"]["test"]["detectors"][name]["per_attack"]
            if r["attack"] == pump.id
        )
        assert row["detected"], (
            f"{name} missed an attack that only moves a constant-in-reference feature"
        )
    assert "PUMP" in out["data"]["constant_features_in_reference"]


def test_thresholds_depend_only_on_the_attack_free_reference(synthetic):
    frames, attacks = synthetic
    changed = {k: v.copy() for k, v in frames.items()}
    for key in ("train", "test"):
        changed[key].loc[:, [c for c in changed[key].columns if c.startswith("S_")]] += 50.0
    a = run.run_case_study(frames, attacks, "x")
    b = run.run_case_study(changed, attacks, "x")
    for name in ("static_limits", "zscore_max", "isolation_forest"):
        assert (
            a["evaluations"]["test"]["detectors"][name]["threshold"]
            == b["evaluations"]["test"]["detectors"][name]["threshold"]
        )


def test_every_detector_gets_the_same_false_alarm_budget_on_the_reference(synthetic):
    frames, attacks = synthetic
    split = int(len(frames["normal"]) * run.NORMAL_FIT_FRACTION)
    days = (len(frames["normal"]) - split) / 24
    out = run.run_case_study(frames, attacks, "x", max_false_alarms_per_day=1.0)
    assert out["protocol"]["threshold_source"].startswith("last 20 %")
    assert days > 0 and out["data"]["reference_calibration_rows"] == len(frames["normal"]) - split


def test_drift_diagnostic_uses_attack_free_hours_only(synthetic, result):
    _, attacks = synthetic
    for name in ("train", "test"):
        ev = result["evaluations"][name]
        assert result["drift"][name]["normal_hours"] == ev["attack_free_hours"]


def test_requires_attacks_in_both_sets(synthetic):
    frames, attacks = synthetic
    with pytest.raises(ValueError):
        run.run_case_study(frames, [a for a in attacks if a.dataset == "train"], "x")


def test_missing_feature_in_an_evaluation_file_is_an_error(synthetic):
    frames, attacks = synthetic
    broken = dict(frames, test=frames["test"].drop(columns=["S_1"]))
    with pytest.raises(bd.SchemaError):
        run.run_case_study(broken, attacks, "x")


def test_cli_synthetic_writes_to_the_smoke_directory_not_the_app_data(tmp_path):
    assert run.main(["--synthetic", "--out-dir", str(tmp_path)]) == 0
    written = json.loads((tmp_path / "results.json").read_text())
    assert "NOT BATADAL" in written["data_source"]
    assert run.SMOKE_OUT_DIR != run.DEFAULT_OUT_DIR


def test_cli_without_data_exits_2(tmp_path, capsys):
    assert run.main(["--data-dir", str(tmp_path)]) == 2
    assert "not found" in capsys.readouterr().err


def test_cli_reads_files_in_the_real_layout(tmp_path, monkeypatch, synthetic):
    frames, attacks = synthetic
    write_files(frames, tmp_path)
    attacks_path = tmp_path / "attacks.json"
    write_attacks(attacks, attacks_path)
    # synthetic files have different hashes than the pinned real ones
    monkeypatch.setattr(
        bd,
        "DATASET_FILES",
        tuple(bd.DatasetFile(s.key, s.filename, s.role, None) for s in bd.DATASET_FILES),
    )
    monkeypatch.setattr(bd, "ATTACKS_FILE", attacks_path)
    monkeypatch.setattr(bd, "load_attacks", lambda path=attacks_path: _load(path))
    out = tmp_path / "out"
    assert run.main(["--data-dir", str(tmp_path), "--out-dir", str(out)]) == 0
    written = json.loads((out / "results.json").read_text())
    assert written["data_source"].startswith("BATADAL")
    assert written["evaluations"]["test"]["attacks"] == 3
    assert np.isfinite(written["evaluations"]["test"]["detectors"]["zscore_max"]["threshold"])


def _load(path):
    raw = json.loads(path.read_text())["attacks"]
    import pandas as pd

    return [
        bd.Attack(
            a["id"],
            a["dataset"],
            pd.Timestamp(a["start"]),
            pd.Timestamp(a["end"]),
            a["duration_hours"],
            a["description"],
            a["concealment"],
            a.get("labeled_hours"),
        )
        for a in raw
    ]
