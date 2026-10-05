"""Anomaly detectors compared in the case study.

Every detector exposes ``fit(X, y=None)`` and ``score(X)``; a HIGHER score means MORE anomalous.
Operating thresholds are never set here: they are calibrated on attack-free data in the pipeline
so every detector faces the same false-alarm budget.
"""

from __future__ import annotations

from typing import Protocol

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler


class Detector(Protocol):
    name: str
    supervised: bool

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> Detector: ...

    def score(self, X: np.ndarray) -> np.ndarray: ...


class StaticLimitDetector:
    """Naive baseline: alarm when any sensor leaves the range seen in attack-free training."""

    name = "static_limits"
    supervised = False

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> StaticLimitDetector:
        self.lo_, self.hi_ = X.min(axis=0), X.max(axis=0)
        self.span_ = np.where(self.hi_ - self.lo_ > 0, self.hi_ - self.lo_, 1.0)
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        below = (self.lo_ - X) / self.span_
        above = (X - self.hi_) / self.span_
        return np.maximum(np.maximum(below, above), 0.0).max(axis=1)


class ZScoreDetector:
    """Per-sensor z-score against the attack-free baseline; score is the largest |z|.

    This is the same family as the runtime scorer in ``src/lib/anomaly-scorer.ts``, so it
    answers "does the current dashboard logic hold up on real attack data?".
    """

    name = "zscore_max"
    supervised = False

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> ZScoreDetector:
        self.mean_ = X.mean(axis=0)
        self.std_ = np.where(X.std(axis=0) > 1e-9, X.std(axis=0), 1.0)
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        return np.abs((X - self.mean_) / self.std_).max(axis=1)


class IsolationForestDetector:
    name = "isolation_forest"
    supervised = False

    def __init__(self, seed: int = 42, n_estimators: int = 200) -> None:
        self.seed, self.n_estimators = seed, n_estimators

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> IsolationForestDetector:
        self.scaler_ = StandardScaler().fit(X)
        self.model_ = IsolationForest(
            n_estimators=self.n_estimators, random_state=self.seed, n_jobs=1
        ).fit(self.scaler_.transform(X))
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        return -self.model_.score_samples(self.scaler_.transform(X))


class GradientBoostingDetector:
    """Supervised reference: needs labelled attacks, so it is an upper-bound style comparison."""

    name = "hist_gradient_boosting"
    supervised = True

    def __init__(self, seed: int = 42) -> None:
        self.seed = seed

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> GradientBoostingDetector:
        if y is None or len(np.unique(y)) < 2:
            raise ValueError("supervised detector needs both classes in training labels")
        self.model_ = HistGradientBoostingClassifier(
            class_weight="balanced", random_state=self.seed, max_iter=200
        ).fit(X, y)
        return self

    def score(self, X: np.ndarray) -> np.ndarray:
        return self.model_.predict_proba(X)[:, 1]


def default_detectors(seed: int = 42) -> list[Detector]:
    return [
        StaticLimitDetector(),
        ZScoreDetector(),
        IsolationForestDetector(seed=seed),
        GradientBoostingDetector(seed=seed),
    ]
