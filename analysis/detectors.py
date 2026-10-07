"""Anomaly detectors compared in the case study.

Every detector exposes ``fit(X, y=None)`` and ``score(X)``; a HIGHER score means MORE anomalous.
Operating thresholds are never set here: they are calibrated on attack-free data in the pipeline
so every detector faces the same false-alarm budget.

Detectors that score each feature separately also expose ``contributions(X)``, an
``(n_samples, n_features)`` array whose row maximum is the score; protocol v3 uses it to check
whether an alarm points at the attacked equipment.

The temporal detectors (protocol v3, docs/protocol-v3.md) are causal: the score at hour t uses
hours <= t only. Each ``score`` call receives ONE contiguous hourly series and starts from a fresh
state, so warm-up is handled identically during threshold calibration and evaluation.
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

    def contributions(self, X: np.ndarray) -> np.ndarray:
        below = (self.lo_ - X) / self.span_
        above = (X - self.hi_) / self.span_
        return np.maximum(np.maximum(below, above), 0.0)

    def score(self, X: np.ndarray) -> np.ndarray:
        return self.contributions(X).max(axis=1)


class ZScoreDetector:
    """Per-sensor z-score against the attack-free baseline; score is the largest |z|.

    This is the same family as the runtime scorer in ``src/lib/anomaly-scorer.ts``, so it
    answers "does the current dashboard logic hold up on real attack data?".
    """

    name = "zscore_max"
    supervised = False

    # Pre-registered rule for constant features (decided from the data's structure, before any
    # detection result was seen): the std is floored at STD_FLOOR_REL * max(1, |mean|), so any
    # departure from a constant baseline produces a very large z instead of a division by zero
    # or a silently ignored feature.
    STD_FLOOR_REL = 1e-3

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> ZScoreDetector:
        self.mean_ = X.mean(axis=0)
        floor = self.STD_FLOOR_REL * np.maximum(1.0, np.abs(self.mean_))
        self.std_ = np.maximum(X.std(axis=0), floor)
        return self

    def z(self, X: np.ndarray) -> np.ndarray:
        """Signed per-feature z-scores against the attack-free baseline."""
        return (X - self.mean_) / self.std_

    def contributions(self, X: np.ndarray) -> np.ndarray:
        return np.abs(self.z(X))

    def score(self, X: np.ndarray) -> np.ndarray:
        return self.contributions(X).max(axis=1)


class EwmaZDetector:
    """EWMA of each feature's signed z-score; score is the largest |EWMA| (protocol v3).

    lambda = 0.2 is the usual EWMA control-chart choice; it is fixed, not tuned.
    """

    name = "ewma_z"
    supervised = False

    def __init__(self, lam: float = 0.2) -> None:
        self.lam = lam

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> EwmaZDetector:
        self.base_ = ZScoreDetector().fit(X)
        return self

    def contributions(self, X: np.ndarray) -> np.ndarray:
        z = self.base_.z(X)
        out = np.empty_like(z)
        state = np.zeros(z.shape[1])
        for t in range(len(z)):
            state = self.lam * z[t] + (1.0 - self.lam) * state
            out[t] = state
        return np.abs(out)

    def score(self, X: np.ndarray) -> np.ndarray:
        return self.contributions(X).max(axis=1)


class CusumDetector:
    """Two-sided tabular CUSUM on each feature's z-score; score is the largest statistic (v3).

    k = 0.5 targets a one-standard-deviation shift (textbook default). The decision interval h is
    not a parameter: the calibrated alarm threshold plays that role. The statistics never reset.
    """

    name = "cusum"
    supervised = False

    def __init__(self, k: float = 0.5) -> None:
        self.k = k

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> CusumDetector:
        self.base_ = ZScoreDetector().fit(X)
        return self

    def contributions(self, X: np.ndarray) -> np.ndarray:
        z = self.base_.z(X)
        out = np.empty_like(z)
        upper = np.zeros(z.shape[1])
        lower = np.zeros(z.shape[1])
        for t in range(len(z)):
            upper = np.maximum(0.0, upper + z[t] - self.k)
            lower = np.maximum(0.0, lower - z[t] - self.k)
            out[t] = np.maximum(upper, lower)
        return out

    def score(self, X: np.ndarray) -> np.ndarray:
        return self.contributions(X).max(axis=1)


class RollingResidualDetector:
    """|x_t - mean of the previous `window` hours| / reference std, per feature (protocol v3).

    window = 24 h, one daily demand cycle. Before 24 hours of history exist, the available history
    is used; the first hour of a series scores 0.
    """

    name = "rolling_residual"
    supervised = False

    def __init__(self, window: int = 24) -> None:
        self.window = window

    def fit(self, X: np.ndarray, y: np.ndarray | None = None) -> RollingResidualDetector:
        self.base_ = ZScoreDetector().fit(X)
        return self

    def contributions(self, X: np.ndarray) -> np.ndarray:
        X = np.asarray(X, dtype=float)
        n = len(X)
        csum = np.vstack([np.zeros((1, X.shape[1])), np.cumsum(X, axis=0)])
        t = np.arange(n)
        lo = np.maximum(0, t - self.window)
        count = (t - lo).astype(float)
        out = np.zeros_like(X)
        has_history = count > 0
        mean_prev = (csum[t[has_history]] - csum[lo[has_history]]) / count[has_history, None]
        out[has_history] = np.abs(X[has_history] - mean_prev) / self.base_.std_
        return out

    def score(self, X: np.ndarray) -> np.ndarray:
        return self.contributions(X).max(axis=1)


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
        EwmaZDetector(),
        CusumDetector(),
        RollingResidualDetector(),
        IsolationForestDetector(seed=seed),
        GradientBoostingDetector(seed=seed),
    ]
