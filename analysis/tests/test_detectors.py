import numpy as np
import pytest

from detectors import (
    GradientBoostingDetector,
    IsolationForestDetector,
    StaticLimitDetector,
    ZScoreDetector,
)


@pytest.fixture
def data():
    rng = np.random.default_rng(1)
    normal = rng.normal(0, 1, size=(500, 4))
    shifted = rng.normal(0, 1, size=(50, 4)) + np.array([6, 0, 0, 0])
    return normal, shifted


@pytest.mark.parametrize("cls", [StaticLimitDetector, ZScoreDetector, IsolationForestDetector])
def test_unsupervised_scores_shifted_data_higher(cls, data):
    normal, shifted = data
    det = cls().fit(normal)
    assert det.score(shifted).mean() > det.score(normal).mean()


def test_static_limits_zero_inside_range(data):
    normal, _ = data
    det = StaticLimitDetector().fit(normal)
    assert np.all(det.score(normal) == 0.0)


def test_zscore_flags_any_departure_from_a_constant_feature():
    X = np.column_stack([np.zeros(200), np.random.default_rng(0).normal(size=200)])
    det = ZScoreDetector().fit(X)
    quiet = det.score(np.array([[0.0, 0.0]]))[0]
    moved = det.score(np.array([[30.0, 0.0]]))[0]
    assert moved > 1000 * max(quiet, 1.0)  # a moved constant dominates, it is not ignored


def test_static_limits_flag_a_moved_constant_feature():
    X = np.column_stack([np.zeros(100), np.linspace(0, 1, 100)])
    det = StaticLimitDetector().fit(X)
    assert det.score(np.array([[0.0, 0.5]]))[0] == 0.0
    assert det.score(np.array([[5.0, 0.5]]))[0] > 0.0


def test_zscore_constant_feature_is_safe():
    X = np.column_stack([np.ones(50), np.linspace(0, 1, 50)])
    det = ZScoreDetector().fit(X)
    assert np.isfinite(det.score(X)).all()


def test_supervised_requires_both_classes(data):
    normal, shifted = data
    X = np.vstack([normal, shifted])
    y = np.r_[np.zeros(len(normal)), np.ones(len(shifted))].astype(int)
    det = GradientBoostingDetector().fit(X, y)
    assert det.score(shifted).mean() > det.score(normal).mean()
    with pytest.raises(ValueError):
        GradientBoostingDetector().fit(normal, np.zeros(len(normal), dtype=int))
    with pytest.raises(ValueError):
        GradientBoostingDetector().fit(normal)
