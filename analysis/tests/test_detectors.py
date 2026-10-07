import numpy as np
import pytest

from detectors import (
    CusumDetector,
    EwmaZDetector,
    GradientBoostingDetector,
    IsolationForestDetector,
    RollingResidualDetector,
    StaticLimitDetector,
    ZScoreDetector,
    default_detectors,
)

TEMPORAL = [EwmaZDetector, CusumDetector, RollingResidualDetector]
PER_FEATURE = [StaticLimitDetector, ZScoreDetector, *TEMPORAL]


@pytest.fixture
def data():
    rng = np.random.default_rng(1)
    normal = rng.normal(0, 1, size=(500, 4))
    shifted = rng.normal(0, 1, size=(50, 4)) + np.array([6, 0, 0, 0])
    return normal, shifted


@pytest.mark.parametrize(
    "cls", [StaticLimitDetector, ZScoreDetector, IsolationForestDetector, *TEMPORAL]
)
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


@pytest.fixture
def reference():
    return np.random.default_rng(7).normal(0, 1, size=(2000, 3))


@pytest.mark.parametrize("cls", PER_FEATURE)
def test_contributions_row_maximum_is_the_score(cls, reference):
    detector = cls().fit(reference)
    X = np.random.default_rng(8).normal(0, 1.5, size=(200, 3))
    contributions = detector.contributions(X)
    assert contributions.shape == X.shape
    np.testing.assert_allclose(contributions.max(axis=1), detector.score(X))


@pytest.mark.parametrize("cls", TEMPORAL)
def test_temporal_detectors_are_causal(cls, reference):
    detector = cls().fit(reference)
    X = np.random.default_rng(9).normal(0, 1, size=(120, 3))
    changed_future = X.copy()
    changed_future[60:] += 50.0
    np.testing.assert_allclose(detector.score(X)[:60], detector.score(changed_future)[:60])


@pytest.mark.parametrize("cls", TEMPORAL)
def test_each_series_starts_from_a_fresh_state(cls, reference):
    detector = cls().fit(reference)
    X = np.random.default_rng(10).normal(0, 1, size=(80, 3))
    np.testing.assert_allclose(detector.score(X), detector.score(X))


def test_ewma_follows_its_recursion():
    detector = EwmaZDetector(lam=0.2)
    detector.fit(np.array([[-1.0], [1.0]]))  # mean 0, std 1: z equals x
    scores = detector.score(np.array([[1.0], [1.0], [-2.0]]))
    np.testing.assert_allclose(scores, [0.2, 0.36, abs(0.2 * -2.0 + 0.8 * 0.36)])


def test_cusum_accumulates_a_small_sustained_shift_that_per_hour_z_misses(reference):
    rng = np.random.default_rng(11)
    X = rng.normal(0, 1, size=(200, 3))
    X[100:, 0] += 1.0  # a one-sigma shift: every single hour still looks ordinary
    z_scores = ZScoreDetector().fit(reference).score(X)
    cusum = CusumDetector(k=0.5).fit(reference).score(X)
    assert z_scores[100:].max() < 5.0
    assert cusum[150:].mean() > 10.0 * cusum[:100].mean()


def test_cusum_follows_its_recursion():
    detector = CusumDetector(k=0.5)
    detector.fit(np.array([[-1.0], [1.0]]))
    scores = detector.score(np.array([[2.0], [2.0], [-3.0]]))
    # upper: 1.5, 3.0, 0; lower: 0, 0, 2.5
    np.testing.assert_allclose(scores, [1.5, 3.0, 2.5])


def test_rolling_residual_reacts_to_a_jump_then_adapts(reference):
    X = np.zeros((100, 3))
    X[50:, 1] = 8.0
    scores = RollingResidualDetector(window=24).fit(reference).score(X)
    assert scores[0] == 0.0
    assert scores[50] > 5.0
    assert scores[80] < 0.5  # the new level is now the recent past


def test_v3_detectors_are_in_the_default_set_after_the_v2_ones():
    names = [d.name for d in default_detectors()]
    assert names == [
        "static_limits",
        "zscore_max",
        "ewma_z",
        "cusum",
        "rolling_residual",
        "isolation_forest",
        "hist_gradient_boosting",
    ]
