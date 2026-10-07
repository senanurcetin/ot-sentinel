import json

import export_model as em


def test_committed_artifact_matches_export():
    assert em.main(["--check"]) == 0


def test_artifact_has_all_sensors_with_positive_std_and_weights_sum_to_one():
    params = json.loads(em.TARGET.read_text(encoding="utf-8"))
    assert set(params["sensors"]) == set(em.SENSORS)
    assert all(s["std"] > 0 for s in params["sensors"].values())
    assert abs(sum(s["weight"] for s in params["sensors"].values()) - 1.0) < 1e-9
    assert params["critical_risk_threshold"] == em.CRITICAL_RISK_THRESHOLD


def test_model_card_table_is_generated_from_the_artifact():
    card = em.MODEL_CARD.read_text(encoding="utf-8")
    block = card[card.index(em.CARD_BEGIN) : card.index(em.CARD_END)]
    for name, sensor in json.loads(em.TARGET.read_text(encoding="utf-8"))["sensors"].items():
        assert f"| {name} | {sensor['mean']} | {sensor['std']} |" in block


def test_apply_card_requires_markers_and_is_idempotent():
    import pytest

    with pytest.raises(ValueError):
        em.apply_card("no markers here", "table")
    once = em.apply_card(f"a\n{em.CARD_BEGIN}\nold\n{em.CARD_END}\nz", "NEW")
    assert "NEW" in once and "old" not in once
    assert em.apply_card(once, "NEW") == once
