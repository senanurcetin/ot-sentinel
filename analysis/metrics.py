"""Evaluation metrics for attack detection on time series.

Point-wise accuracy flatters detectors on long attack-free stretches, so the headline numbers
are event-level: was each attack caught, how late, and how many false alarms per day.
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import average_precision_score


def find_segments(flags: np.ndarray) -> list[tuple[int, int]]:
    """Maximal runs of truthy values as ``(start, end)`` with ``end`` exclusive."""
    padded = np.concatenate([[0], np.asarray(flags, dtype=int), [0]])
    edges = np.diff(padded)
    return list(zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1), strict=True))


def point_metrics(
    y_true: np.ndarray, score: np.ndarray, threshold: float
) -> dict[str, float | None]:
    y = np.asarray(y_true, dtype=int)
    alarm = np.asarray(score) >= threshold
    tp = int(np.sum(alarm & (y == 1)))
    fp = int(np.sum(alarm & (y == 0)))
    fn = int(np.sum(~alarm & (y == 1)))
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision is not None and recall is not None and precision + recall
        else None
    )
    pr_auc = float(average_precision_score(y, score)) if 0 < y.sum() < len(y) else None
    return {"precision": precision, "recall": recall, "f1": f1, "pr_auc": pr_auc}


def event_metrics(y_true: np.ndarray, alarm: np.ndarray, step_hours: float = 1.0) -> dict:
    """Event-level detection quality.

    * An attack event is *detected* if any alarm falls inside it.
    * Time-to-detect is hours from the event start to its first alarm sample.
    * A *false alarm* is an alarm segment that overlaps no attack event.
    * ``false_alarms_per_day`` is normalised by the attack-free time in the evaluation window.
    """
    y = np.asarray(y_true, dtype=int)
    alarm = np.asarray(alarm, dtype=bool)
    events = find_segments(y == 1)

    ttd: list[float] = []
    for start, end in events:
        hits = np.flatnonzero(alarm[start:end])
        if hits.size:
            ttd.append(float(hits[0]) * step_hours)

    false_segments = [(s, e) for s, e in find_segments(alarm) if not np.any(y[s:e] == 1)]
    normal_days = float(np.sum(y == 0)) * step_hours / 24.0
    return {
        "n_events": len(events),
        "events_detected": len(ttd),
        "event_recall": len(ttd) / len(events) if events else None,
        "median_time_to_detect_h": float(np.median(ttd)) if ttd else None,
        "mean_time_to_detect_h": float(np.mean(ttd)) if ttd else None,
        "false_alarm_segments": len(false_segments),
        "false_alarms_per_day": len(false_segments) / normal_days if normal_days else None,
        "alarm_fraction": float(alarm.mean()) if alarm.size else None,
    }


def calibrate_threshold(
    normal_scores: np.ndarray, max_false_alarms_per_day: float, step_hours: float = 1.0
) -> float:
    """Lowest threshold whose false-alarm rate on ATTACK-FREE data is within budget.

    Uses only attack-free scores, so no attack label can influence the operating point.
    """
    scores = np.asarray(normal_scores, dtype=float)
    days = len(scores) * step_hours / 24.0
    if days <= 0:
        raise ValueError("no calibration data")
    candidates = np.unique(np.quantile(scores, np.linspace(0.5, 1.0, 501)))
    for threshold in candidates:
        n_segments = len(find_segments(scores >= threshold))
        if n_segments / days <= max_false_alarms_per_day:
            return float(threshold)
    return float(np.nextafter(scores.max(), np.inf))


def split_index_outside_event(y: np.ndarray, fraction: float) -> int:
    """First index at or after ``fraction`` of the series where two attack-free samples precede.

    Splitting inside an attack event would leak half of it into training.
    """
    y = np.asarray(y, dtype=int)
    idx = max(2, int(len(y) * fraction))
    while idx < len(y) and (y[idx] == 1 or y[idx - 1] == 1):
        idx += 1
    return idx
