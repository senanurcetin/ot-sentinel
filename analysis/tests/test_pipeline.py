import json

import numpy as np
import pytest

import run_batadal_case_study as run
from synthetic import make_synthetic, write_csv


def test_pipeline_runs_and_is_deterministic():
    a = run.run_case_study(make_synthetic(), "synthetic")
    b = run.run_case_study(make_synthetic(), "synthetic")
    assert a == b
    assert set(a["detectors"]) == {
        "static_limits",
        "zscore_max",
        "isolation_forest",
        "hist_gradient_boosting",
    }
    # the synthetic attacks are large shifts: a z-score detector must catch most of them
    assert a["detectors"]["zscore_max"]["event"]["event_recall"] >= 0.5
    assert a["limitations"]


def test_threshold_depends_only_on_attack_free_data():
    base = make_synthetic()
    changed = make_synthetic()
    changed["attack"] = changed["attack"].copy()
    changed["attack"].iloc[:, :8] += 50.0  # wreck the labelled file
    a = run.run_case_study(base, "x")
    b = run.run_case_study(changed, "x")
    for name in ("static_limits", "zscore_max", "isolation_forest"):
        assert a["detectors"][name]["threshold"] == b["detectors"][name]["threshold"]


def test_unlabelled_rows_are_dropped_and_reported():
    frames = make_synthetic()
    frames["attack"].loc[frames["attack"].index[:30], "label"] = np.nan
    out = run.run_case_study(frames, "x")
    assert out["data"]["unlabelled_rows_dropped"] == 30


def test_rejects_labelled_file_without_attacks():
    frames = make_synthetic()
    frames["attack"]["label"] = 0
    with pytest.raises(ValueError):
        run.run_case_study(frames, "x")


def test_cli_synthetic_writes_to_smoke_dir_not_app_data(tmp_path, capsys):
    assert run.main(["--synthetic", "--out-dir", str(tmp_path)]) == 0
    written = json.loads((tmp_path / "results.json").read_text())
    assert "NOT BATADAL" in written["data_source"]
    assert run.SMOKE_OUT_DIR != run.DEFAULT_OUT_DIR


def test_cli_without_data_exits_2(tmp_path, capsys):
    assert run.main(["--data-dir", str(tmp_path)]) == 2
    assert "not found" in capsys.readouterr().err


def test_cli_loads_csv_files_from_disk(tmp_path):
    frames = make_synthetic()
    write_csv(frames["normal"], tmp_path / "BATADAL_dataset03.csv")
    write_csv(frames["attack"], tmp_path / "BATADAL_dataset04.csv")
    out = tmp_path / "out"
    assert run.main(["--data-dir", str(tmp_path), "--out-dir", str(out)]) == 0
    assert json.loads((out / "results.json").read_text())["data_source"].startswith("BATADAL")
