import numpy as np
import pytest

from metrics import (
    calibrate_threshold,
    chance_top_k_hit,
    day_block_bootstrap,
    event_metrics,
    explanation_accuracy,
    find_segments,
    per_attack,
    point_metrics,
    split_index_outside_event,
)


def test_find_segments_edges_and_empty():
    assert find_segments(np.array([1, 1, 0, 1, 0, 0, 1])) == [(0, 2), (3, 4), (6, 7)]
    assert find_segments(np.zeros(5)) == []
    assert find_segments(np.ones(3)) == [(0, 3)]


def test_event_metrics_detection_delay_and_false_alarms():
    y = np.zeros(48, dtype=int)
    y[10:20] = 1
    y[30:35] = 1
    alarm = np.zeros(48, dtype=bool)
    alarm[13:15] = True  # catches event 1 three hours in
    alarm[40:42] = True  # false alarm; event 2 missed
    m = event_metrics(y, alarm)
    assert m["n_events"] == 2 and m["events_detected"] == 1
    assert m["event_recall"] == 0.5
    assert m["median_time_to_detect_h"] == 3.0
    assert m["false_alarm_segments"] == 1
    normal_days = (48 - 15) / 24
    assert m["false_alarms_per_day"] == pytest.approx(1 / normal_days)


def test_alarm_overlapping_event_is_not_false_alarm():
    y = np.zeros(20, dtype=int)
    y[5:10] = 1
    alarm = np.zeros(20, dtype=bool)
    alarm[8:14] = True  # starts inside the event, lingers after it
    assert event_metrics(y, alarm)["false_alarm_segments"] == 0


def test_no_events_gives_none_recall():
    m = event_metrics(np.zeros(10, dtype=int), np.zeros(10, dtype=bool))
    assert m["event_recall"] is None and m["median_time_to_detect_h"] is None


def test_point_metrics_single_class_has_no_pr_auc():
    m = point_metrics(np.zeros(5, dtype=int), np.linspace(0, 1, 5), 0.5)
    assert m["pr_auc"] is None and m["recall"] is None


def test_point_metrics_values():
    y = np.array([0, 0, 1, 1])
    score = np.array([0.1, 0.6, 0.7, 0.2])
    m = point_metrics(y, score, 0.5)
    assert m["precision"] == 0.5 and m["recall"] == 0.5 and m["f1"] == 0.5


def test_calibrate_threshold_meets_budget_and_ignores_attacks():
    rng = np.random.default_rng(0)
    normal = rng.normal(size=24 * 60)
    thr = calibrate_threshold(normal, max_false_alarms_per_day=1.0)
    n_segments = len(find_segments(normal > thr))
    assert n_segments / 60 <= 1.0
    # a stricter budget can only raise the threshold
    assert calibrate_threshold(normal, 0.1) >= thr


def test_calibrate_threshold_impossible_budget_means_no_alarms():
    scores = np.array([1.0, 2.0, 3.0])
    thr = calibrate_threshold(scores, 0.0)
    assert not np.any(scores > thr)


def test_alarm_requires_a_score_strictly_above_the_threshold():
    """A score sitting exactly on the threshold (e.g. 0 inside a static range) is not an alarm."""
    scores = np.array([0.0, 0.0, 5.0, 0.0])
    y = np.array([0, 0, 1, 0])
    m = point_metrics(y, scores, threshold=0.0)
    assert m["precision"] == 1.0 and m["recall"] == 1.0  # only the spike alarms
    thr = calibrate_threshold(np.zeros(24 * 30), max_false_alarms_per_day=1.0)
    assert not np.any(np.zeros(10) > thr)


def test_always_on_alarm_is_exposed_by_the_hour_fraction_and_chance_baseline():
    y = np.zeros(200, dtype=int)
    y[100:130] = 1
    on = event_metrics(y, np.ones(200, dtype=bool))
    assert on["events_detected"] == 1 and on["false_alarm_segments"] == 0  # looks perfect...
    assert on["false_alarm_hour_fraction"] == 1.0  # ...but is on all the time


def test_chance_baseline_follows_the_false_alarm_rate_and_attack_length():
    y = np.zeros(1000, dtype=int)
    y[500:530] = 1  # 30 h attack
    quiet = np.zeros(1000, dtype=bool)
    assert event_metrics(y, quiet)["expected_events_detected_by_chance"] == 0.0
    noisy = np.zeros(1000, dtype=bool)
    noisy[::10] = True  # a false alarm segment every 10 h
    noisy[500:530] = False
    chance = event_metrics(y, noisy)["expected_events_detected_by_chance"]
    rate = (event_metrics(y, noisy)["false_alarm_segments"]) / 970
    assert chance == pytest.approx(1 - np.exp(-rate * 30), abs=1e-9)
    assert 0.5 < chance < 1.0
    assert (
        event_metrics(np.zeros(10, dtype=int), np.zeros(10, dtype=bool))[
            "expected_events_detected_by_chance"
        ]
        is None
    )


def test_split_never_cuts_through_an_event():
    y = np.zeros(100, dtype=int)
    y[45:60] = 1
    idx = split_index_outside_event(y, 0.5)
    assert y[idx] == 0 and y[idx - 1] == 0 and idx >= 60


def test_per_attack_reports_detection_and_delay_for_each_attack():
    ids = np.zeros(60, dtype=int)
    ids[10:20] = 8
    ids[30:35] = 9
    alarm = np.zeros(60, dtype=bool)
    alarm[13:15] = True  # attack 8 caught 3 hours after its start; attack 9 missed
    rows = per_attack(ids, alarm)
    assert rows == [
        {"attack": 8, "duration_hours": 10, "detected": True, "hours_to_detect": 3.0},
        {"attack": 9, "duration_hours": 5, "detected": False, "hours_to_detect": None},
    ]
    assert per_attack(np.zeros(5, dtype=int), np.zeros(5, dtype=bool)) == []


# --- Protocol v3 ---


def test_chance_top_k_hit_matches_brute_force():
    from itertools import combinations

    n, affected = 8, {0, 1}
    draws = list(combinations(range(n), 3))
    expected = sum(1 for d in draws if affected.intersection(d)) / len(draws)
    assert chance_top_k_hit(n, 2, 3) == pytest.approx(expected)
    assert chance_top_k_hit(43, 0, 3) == 0.0


def test_explanation_accuracy_counts_only_alarmed_attack_hours():
    # 3 features; attack 1 targets feature 0 at hours 1-3, attack 2 targets feature 2 at hours 5-6.
    ids = np.array([0, 1, 1, 1, 0, 2, 2])
    alarm = np.array([True, True, True, False, False, True, True])
    contributions = np.array(
        [
            [9, 0, 0],  # hour 0: no attack -> ignored even though it alarms
            [5, 1, 0],  # attack 1, alarmed, feature 0 in top-1 -> hit
            [0, 5, 1],  # attack 1, alarmed, feature 0 last -> miss with k=1
            [9, 0, 0],  # attack 1, NOT alarmed -> ignored
            [0, 0, 0],
            [0, 0, 7],  # attack 2, hit
            [3, 2, 1],  # attack 2, miss with k=1
        ],
        dtype=float,
    )
    result = explanation_accuracy(contributions, alarm, ids, {1: [0], 2: [2]}, k=1)
    assert result["alarmed_attack_hours"] == 4
    assert result["hit_rate"] == pytest.approx(0.5)
    assert [r["hit_rate"] for r in result["per_attack"]] == [0.5, 0.5]
    assert result["chance"] == pytest.approx(1 / 3)


def test_explanation_accuracy_without_alarms_has_no_rate():
    result = explanation_accuracy(np.ones((3, 2)), np.zeros(3, bool), np.array([1, 1, 0]), {1: [0]})
    assert result["hit_rate"] is None
    assert result["per_attack"][0]["alarmed_hours"] == 0


def _two_day_series():
    rng = np.random.default_rng(3)
    days = np.repeat(np.arange(20), 24)
    y = np.zeros(len(days), int)
    y[48:60] = 1
    y[300:320] = 1
    good = y * 3.0 + rng.normal(0, 0.5, len(y))
    noise = rng.normal(0, 1, len(y))
    return y, days, good, noise


def test_bootstrap_is_reproducible_and_brackets_the_point_estimate():
    y, days, good, noise = _two_day_series()
    scores = {"good": (good, 1.5), "noise": (noise, 1.5)}
    a = day_block_bootstrap(y, scores, days, reference="noise", n_boot=200, seed=1)
    b = day_block_bootstrap(y, scores, days, reference="noise", n_boot=200, seed=1)
    assert a == b
    point = point_metrics(y, good, 1.5)["pr_auc"]
    lo, hi = a["intervals"]["good"]["pr_auc"]
    assert lo <= point <= hi
    diff_lo, _ = a["intervals"]["good"]["pr_auc_diff"]
    assert diff_lo > 0  # a clearly better detector is separated from noise on the same resamples
    assert "pr_auc_diff" not in a["intervals"]["noise"]


def test_bootstrap_paired_difference_of_a_detector_with_itself_is_zero():
    y, days, good, _ = _two_day_series()
    result = day_block_bootstrap(
        y, {"a": (good, 1.0), "b": (good.copy(), 1.0)}, days, reference="a", n_boot=100
    )
    assert result["intervals"]["b"]["pr_auc_diff"] == [0.0, 0.0]


def test_bootstrap_skips_resamples_without_both_classes():
    days = np.repeat(np.arange(30), 24)
    y = np.zeros(len(days), int)
    y[:24] = 1  # attacks on a single day: many resamples miss it
    score = y.astype(float)
    result = day_block_bootstrap(y, {"perfect": (score, 0.5)}, days, n_boot=300, seed=0)
    assert result["skipped_single_class_resamples"] > 0
    assert result["intervals"]["perfect"]["precision"] == [1.0, 1.0]
