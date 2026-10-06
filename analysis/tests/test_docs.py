"""Documentation guards: links resolve, numbers are generated, and prose claims match the results.

* Every metric value in the documents lives inside a generated block (see results_report.py), so a
  number can never be typed from memory or go stale; the blocks are checked against results.json.
* The prose makes claims about the results ("every detector catches every attack", "same ordering
  on both files", ...). Each is encoded below, so a different result file breaks the test and
  forces the text to be rewritten.
"""

import json
import re
from pathlib import Path

import pytest

import batadal_data as bd
import results_report as rr
from synthetic import make_synthetic

ROOT = Path(__file__).resolve().parents[2]

DOCS = [
    ROOT / "README.md",
    ROOT / "MODEL_CARD.md",
    ROOT / "SECURITY.md",
    ROOT / "CONTRIBUTING.md",
    ROOT / "DEPENDENCIES.md",
    ROOT / "CHANGELOG.md",
    ROOT / "analysis" / "README.md",
    *sorted((ROOT / "docs").glob("**/*.md")),
]
# Documents that discuss the evaluation: they must not hand-type metric values.
EVALUATION_DOCS = [
    ROOT / "README.md",
    ROOT / "MODEL_CARD.md",
    ROOT / "analysis" / "README.md",
    ROOT / "docs" / "case-study.md",
    ROOT / "docs" / "hiring-summary.md",
]

LINK = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
GENERATED = re.compile(r"<!-- BEGIN results:.*?<!-- END results:[\w-]+ -->", re.S)
METRIC_WITH_VALUE = re.compile(
    r"\b(PR-AUC|ROC-AUC|AUC|precision|recall|F1|time-to-detect)\b[^\n.|]{0,25}?\b\d+\.\d+\b",
    re.IGNORECASE,
)
STALE_STATUS = re.compile(
    r"(has not been run|not been run|not yet run|never been executed|authoring environment could not)",
    re.IGNORECASE,
)


def _rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def _prose(doc: Path) -> str:
    """The document without fenced code and without generated result blocks."""
    text = re.sub(r"```.*?```", "", doc.read_text(encoding="utf-8"), flags=re.S)
    return GENERATED.sub("", text)


@pytest.fixture(scope="module")
def results():
    return json.loads(rr.RESULTS.read_text(encoding="utf-8"))


# --- links ---------------------------------------------------------------------------------------


@pytest.mark.parametrize("doc", DOCS, ids=_rel)
def test_relative_links_resolve(doc):
    text = re.sub(r"```.*?```", "", doc.read_text(encoding="utf-8"), flags=re.S)
    broken = []
    for match in LINK.finditer(text):
        target = match.group(1)
        if re.match(r"^(https?:|mailto:|#)", target):
            continue
        path = target.split("#", 1)[0]
        if path and not (doc.parent / path).resolve().exists():
            broken.append(target)
    assert not broken, f"{_rel(doc)} links to missing files: {broken}"


def test_in_page_anchors_that_the_readme_uses_exist_in_the_case_study():
    case = (ROOT / "docs" / "case-study.md").read_text(encoding="utf-8")
    slugs = {
        re.sub(r"[^a-z0-9 -]", "", h.lower()).strip().replace(" ", "-")
        for h in re.findall(r"^#{1,4} (.+)$", case, flags=re.M)
    }
    for doc in (ROOT / "README.md", ROOT / "docs" / "hiring-summary.md"):
        for anchor in re.findall(r"case-study\.md#([\w-]+)", doc.read_text(encoding="utf-8")):
            assert anchor in slugs, f"{_rel(doc)} links to a missing case-study heading '{anchor}'"


def test_readme_references_existing_demo_assets():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assets = set(re.findall(r"docs/assets/[\w.-]+", readme))
    assert assets
    assert not [a for a in assets if not (ROOT / a).exists()]


# --- numbers are generated ----------------------------------------------------------------------


def test_results_are_from_the_real_benchmark_not_the_synthetic_smoke_test(results):
    assert results["data_source"].startswith("BATADAL")
    assert "NOT BATADAL" not in results["data_source"]
    assert results["protocol"]["version"] == 2


def test_generated_blocks_are_up_to_date():
    assert rr.main(["--check"]) == 0


@pytest.mark.parametrize("doc", EVALUATION_DOCS, ids=_rel)
def test_metric_values_only_appear_in_generated_blocks(doc):
    found = METRIC_WITH_VALUE.findall(_prose(doc))
    assert not found, f"{_rel(doc)} types metric values by hand: {found}"


@pytest.mark.parametrize("doc", EVALUATION_DOCS, ids=_rel)
def test_no_stale_not_run_statements(doc):
    assert not STALE_STATUS.search(doc.read_text(encoding="utf-8")), (
        f"{_rel(doc)} still says the evaluation has not been run"
    )


def test_case_study_and_readme_contain_the_generated_blocks():
    case = (ROOT / "docs" / "case-study.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for name in ("summary", "per-attack", "drift", "data"):
        assert f"BEGIN results:{name}" in case
    assert "BEGIN results:summary" in readme


# --- prose claims, checked against the results -----------------------------------------------------


def _detectors(results, name):
    return results["evaluations"][name]["detectors"]


def test_claim_every_detector_catches_every_attack_and_chance_alone_would_catch_most(results):
    for name in ("test", "train"):
        for det in _detectors(results, name).values():
            event = det["event"]
            assert event["events_detected"] == event["n_events"] == 7
            assert event["expected_events_detected_by_chance"] >= 0.8 * event["n_events"]


def test_claim_hour_level_results_are_modest(results):
    for name in ("test", "train"):
        for det in _detectors(results, name).values():
            p = det["point"]
            assert not (p["precision"] >= 0.8 and p["recall"] >= 0.8)
            assert p["recall"] < 0.5, "'a minority of attack hours' no longer holds"
    best = _detectors(results, "test")["zscore_max"]["point"]
    train_best = _detectors(results, "train")["zscore_max"]["point"]
    assert 0.4 <= best["precision"] <= 0.6 and 0.4 <= train_best["precision"] <= 0.6  # "about half"


def test_claim_ordering_zscore_then_static_then_isolation_forest_on_both_files(results):
    for name in ("test", "train"):
        d = _detectors(results, name)
        auc = {
            k: d[k]["point"]["pr_auc"] for k in ("zscore_max", "static_limits", "isolation_forest")
        }
        assert auc["zscore_max"] > auc["static_limits"] > auc["isolation_forest"], name
        hours = {
            k: d[k]["event"]["false_alarm_hour_fraction"]
            for k in d
            if k != "hist_gradient_boosting"
        }
        assert min(hours, key=hours.get) == "zscore_max", name


def test_claim_pr_auc_beats_the_random_guess_level(results):
    for name in ("test", "train"):
        ev = results["evaluations"][name]
        base = ev["attack_hours"] / (ev["attack_hours"] + ev["attack_free_hours"])
        for det in ev["detectors"].values():
            assert det["point"]["pr_auc"] > base


def test_claim_supervised_reference_does_not_win(results):
    d = _detectors(results, "test")
    assert d["hist_gradient_boosting"]["point"]["pr_auc"] < d["zscore_max"]["point"]["pr_auc"]


def test_claim_pump_attacks_are_caught_in_the_first_hour_by_static_and_zscore(results):
    d = _detectors(results, "test")
    for name in ("static_limits", "zscore_max"):
        rows = {r["attack"]: r for r in d[name]["per_attack"]}
        assert rows[10]["hours_to_detect"] == 0 and rows[11]["hours_to_detect"] == 0


def test_claim_one_signal_drives_the_static_limit_false_alarms(results):
    for name in ("test", "train"):
        drift = results["drift"][name]["top_features_share_of_hours_outside_reference_range"]
        top, share = next(iter(drift.items()))
        assert top == "P_J280"
        rest = [v for k, v in drift.items() if k != top]
        assert all(v < 0.01 for v in rest), "'every other signal almost never does' no longer holds"
        alarm_share = _detectors(results, name)["static_limits"]["event"][
            "false_alarm_hour_fraction"
        ]
        assert abs(alarm_share - share) < 0.03


def test_claim_the_supervised_reference_is_not_evaluated_on_its_training_file(results):
    assert "hist_gradient_boosting" not in _detectors(results, "train")
    assert results["evaluations"]["train"]["not_evaluated"] == ["hist_gradient_boosting"]


def test_claim_the_seven_reference_constants_are_kept(results):
    assert results["data"]["n_features"] == 43
    assert len(results["data"]["constant_features_in_reference"]) == 7


# --- the renderer itself ---------------------------------------------------------------------------


def test_renderer_emits_valid_tables_and_never_a_stray_pipe():
    frames, attacks = make_synthetic()
    import run_batadal_case_study as run

    res = run.run_case_study(frames, attacks, "synthetic")
    blocks = rr.blocks(res, attacks)
    for name, body in blocks.items():
        for table in body.split("\n\n"):  # a block can hold several tables
            rows = [ln for ln in table.splitlines() if ln.startswith("|")]
            if not rows:
                continue
            widths = {len(r.strip().strip("|").replace("\\|", "").split("|")) for r in rows}
            assert len(widths) == 1, (name, widths, rows[0])
    assert "not evaluated here" in blocks["summary"]


def test_apply_block_replaces_only_the_named_block_and_requires_markers():
    text = "a\n<!-- BEGIN results:x (generated) -->\nold\n<!-- END results:x -->\nz"
    assert "NEW" in rr.apply_block(text, "x", "NEW") and "old" not in rr.apply_block(
        text, "x", "NEW"
    )
    assert rr.apply_block(rr.apply_block(text, "x", "NEW"), "x", "NEW") == rr.apply_block(
        text, "x", "NEW"
    )
    with pytest.raises(ValueError):
        rr.apply_block("no markers", "x", "NEW")


def test_guard_regexes_catch_what_they_should():
    assert METRIC_WITH_VALUE.search("PR-AUC: 0.91")
    assert METRIC_WITH_VALUE.search("event recall of 0.50")
    assert not METRIC_WITH_VALUE.search("PR-AUC and recall are the metrics")
    assert not METRIC_WITH_VALUE.search("the 0.37 % rate")
    assert STALE_STATUS.search("it has not been run on BATADAL")
    assert bd.ATTACKS_FILE.exists()
