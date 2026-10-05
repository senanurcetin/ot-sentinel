import numpy as np
import pytest

from metrics import (
    calibrate_threshold,
    event_metrics,
    find_segments,
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
    n_segments = len(find_segments(normal >= thr))
    assert n_segments / 60 <= 1.0
    # a stricter budget can only raise the threshold
    assert calibrate_threshold(normal, 0.1) >= thr


def test_calibrate_threshold_impossible_budget_exceeds_max():
    scores = np.array([1.0, 2.0, 3.0])
    assert calibrate_threshold(scores, 0.0) > scores.max()


def test_split_never_cuts_through_an_event():
    y = np.zeros(100, dtype=int)
    y[45:60] = 1
    idx = split_index_outside_event(y, 0.5)
    assert y[idx] == 0 and y[idx - 1] == 0 and idx >= 60
