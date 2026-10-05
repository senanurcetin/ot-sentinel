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
