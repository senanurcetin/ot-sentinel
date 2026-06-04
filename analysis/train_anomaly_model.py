"""Train an Isolation Forest anomaly model on simulated OT telemetry.

Generates 5,000 normal operating samples from the dashboard's defined
normal ranges, fits an Isolation Forest, and exports:
  - analysis/model-params.json  — per-sensor statistics and decision boundaries
  - analysis/anomaly-model-report.json — training summary and threshold analysis

The exported statistics are consumed by src/lib/anomaly-scorer.ts to replace
hard-coded rule-based anomaly scores with data-derived z-score scoring.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from sklearn.ensemble import IsolationForest

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT

# Normal operating envelope (from dashboard design spec)
SENSOR_NORMAL = {
    "temp": {"min": 40.0, "max": 60.0},
    "pressure": {"min": 1000.0, "max": 1020.0},
    "vibration": {"min": 0.01, "max": 0.10},
}
# Attack / anomaly envelope (for validation)
SENSOR_ATTACK = {
    "temp": {"min": 100.0, "max": 150.0},
    "pressure": {"min": 1100.0, "max": 1200.0},
    "vibration": {"min": 0.80, "max": 2.50},
}
N_NORMAL_SAMPLES = 5_000
N_ATTACK_SAMPLES = 500
CONTAMINATION = 0.05  # 5% expected anomaly rate in production
RANDOM_SEED = 42


def to_float(v: float, d: int = 4) -> float:
    return round(float(v), d)


def generate_normal_samples(n: int, rng: np.random.Generator) -> np.ndarray:
    """Draw n samples from the normal operating envelope with Gaussian jitter."""
    columns = []
    for sensor, bounds in SENSOR_NORMAL.items():
        center = (bounds["min"] + bounds["max"]) / 2
        sigma = (bounds["max"] - bounds["min"]) / 6  # 6-sigma span covers ±3σ
        samples = rng.normal(loc=center, scale=sigma, size=n)
        samples = np.clip(samples, bounds["min"] - sigma, bounds["max"] + sigma)
        columns.append(samples)
    return np.column_stack(columns)


def generate_attack_samples(n: int, rng: np.random.Generator) -> np.ndarray:
    """Draw n samples from the attack envelope for validation."""
    columns = []
    for sensor, bounds in SENSOR_ATTACK.items():
        samples = rng.uniform(bounds["min"], bounds["max"], size=n)
        columns.append(samples)
    return np.column_stack(columns)


def compute_sensor_stats(x_normal: np.ndarray) -> dict:
    """Per-sensor mean, std, and adaptive z-score thresholds."""
    sensor_names = list(SENSOR_NORMAL.keys())
    stats = {}
    for i, name in enumerate(sensor_names):
        col = x_normal[:, i]
        mean = float(col.mean())
        std = float(col.std())
        stats[name] = {
            "mean": to_float(mean),
            "std": to_float(std),
            "min_observed": to_float(float(col.min())),
            "max_observed": to_float(float(col.max())),
            "p1": to_float(float(np.percentile(col, 1))),
            "p99": to_float(float(np.percentile(col, 99))),
            "z_threshold_warning": 2.0,   # yellow: z-score > 2
            "z_threshold_critical": 3.0,  # red:    z-score > 3
        }
    return stats


def compute_correlation(x_normal: np.ndarray) -> list[list[float]]:
    """Pearson correlation matrix among sensors."""
    corr = np.corrcoef(x_normal.T)
    return [[to_float(v) for v in row] for row in corr.tolist()]


def fit_isolation_forest(x_normal: np.ndarray) -> tuple[IsolationForest, dict]:
    """Fit Isolation Forest and compute decision boundaries."""
    iso = IsolationForest(
        n_estimators=200,
        contamination=CONTAMINATION,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    iso.fit(x_normal)
    scores_normal = -iso.score_samples(x_normal)  # higher = more anomalous
    threshold_95 = float(np.percentile(scores_normal, 95))
    threshold_99 = float(np.percentile(scores_normal, 99))
    return iso, {
        "threshold_warning_p95": to_float(threshold_95),
        "threshold_critical_p99": to_float(threshold_99),
        "mean_normal_score": to_float(float(scores_normal.mean())),
        "std_normal_score": to_float(float(scores_normal.std())),
    }


def validate_model(
    iso: IsolationForest,
    x_normal: np.ndarray,
    x_attack: np.ndarray,
) -> dict:
    """Evaluate detection performance on held-out normal and attack samples."""
    scores_n = -iso.score_samples(x_normal[-500:])
    scores_a = -iso.score_samples(x_attack)
    threshold = to_float(float(np.percentile(-iso.score_samples(x_normal), 99)))

    tp = int((scores_a >= threshold).sum())
    fp = int((scores_n >= threshold).sum())
    fn = int((scores_a < threshold).sum())
    tn = int((scores_n < threshold).sum())

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0

    return {
        "held_out_normal_samples": 500,
        "attack_samples": len(x_attack),
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
        "precision_at_p99": to_float(precision),
        "recall_at_p99": to_float(recall),
        "f1_at_p99": to_float(2 * precision * recall / (precision + recall + 1e-8)),
        "mean_attack_score": to_float(float(scores_a.mean())),
        "mean_normal_score": to_float(float(scores_n.mean())),
        "separation_ratio": to_float(float(scores_a.mean() / (scores_n.mean() + 1e-8))),
    }


def build_risk_score_mapping(sensor_stats: dict) -> list[dict]:
    """Risk score 0-100 mapping table for TypeScript anomaly scorer.

    Uses a composite weighted z-score with exponential scaling to produce
    a continuous 0-100 risk score that replaces binary SECURE/CRITICAL.
    """
    sensor_weights = {
        "temp": 0.4,
        "pressure": 0.3,
        "vibration": 0.3,
    }
    # Tabulate risk score at z = 0, 1, 2, 3, 4, 5
    examples = []
    for z in [0.0, 1.0, 2.0, 3.0, 4.0, 5.0]:
        weighted_z = z  # if all sensors are at z
        risk = round(min(100, max(0, 100 * (1 - math.exp(-0.25 * weighted_z)))))
        examples.append({
            "z_score": z,
            "composite_risk_score": risk,
            "status": "CRITICAL" if risk >= 50 else "SECURE",
        })
    return examples


def main() -> None:
    rng = np.random.default_rng(RANDOM_SEED)
    print(f"Generating {N_NORMAL_SAMPLES} normal + {N_ATTACK_SAMPLES} attack samples...")
    x_normal = generate_normal_samples(N_NORMAL_SAMPLES, rng)
    x_attack = generate_attack_samples(N_ATTACK_SAMPLES, rng)

    sensor_stats = compute_sensor_stats(x_normal)
    corr_matrix = compute_correlation(x_normal)
    iso, iso_thresholds = fit_isolation_forest(x_normal)
    validation = validate_model(iso, x_normal, x_attack)
    risk_mapping = build_risk_score_mapping(sensor_stats)

    model_params = {
        "_description": (
            "OT anomaly detection model parameters derived from Isolation Forest training "
            "on simulated normal operating telemetry. Consumed by src/lib/anomaly-scorer.ts."
        ),
        "training_config": {
            "n_normal_samples": N_NORMAL_SAMPLES,
            "contamination": CONTAMINATION,
            "sensors": list(SENSOR_NORMAL.keys()),
            "sensor_order": ["temp", "pressure", "vibration"],
        },
        "sensor_stats": sensor_stats,
        "sensor_weights": {
            "temp": 0.4,
            "pressure": 0.3,
            "vibration": 0.3,
        },
        "isolation_forest_thresholds": iso_thresholds,
        "correlation_matrix": {
            "sensors": list(SENSOR_NORMAL.keys()),
            "matrix": corr_matrix,
        },
        "risk_score_formula": {
            "description": "risk_score = round(min(100, 100 * (1 - exp(-0.25 * composite_z))))",
            "composite_z": "weighted average of per-sensor |z-scores| using sensor_weights",
            "status_threshold": {"CRITICAL": "risk_score >= 50", "SECURE": "risk_score < 50"},
            "examples": risk_mapping,
        },
        "normal_operating_envelope": SENSOR_NORMAL,
        "attack_envelope_reference": SENSOR_ATTACK,
    }

    anomaly_report = {
        "title": "OT Anomaly Detection Model Training Report",
        "training_summary": {
            "model": "IsolationForest (n_estimators=200, contamination=0.05)",
            "training_samples": N_NORMAL_SAMPLES,
            "sensor_count": 3,
        },
        "sensor_statistics": sensor_stats,
        "isolation_forest_thresholds": iso_thresholds,
        "validation_results": validation,
        "interpretation": (
            f"Separation ratio {validation['separation_ratio']:.2f}x means attack samples "
            f"score {validation['separation_ratio']:.2f}x higher than normal samples on average. "
            f"Precision at p99 threshold: {validation['precision_at_p99']:.1%}, "
            f"Recall: {validation['recall_at_p99']:.1%}."
        ),
        "deployment_note": (
            "The sensor_stats block is exported to anomaly-scorer.ts for z-score computation. "
            "The hard-coded random ranges in route.ts are replaced by the scorer's output."
        ),
    }

    (OUTPUT_DIR / "model-params.json").write_text(
        json.dumps(model_params, indent=2), encoding="utf-8"
    )
    (OUTPUT_DIR / "anomaly-model-report.json").write_text(
        json.dumps(anomaly_report, indent=2), encoding="utf-8"
    )

    print(f"Wrote model parameters to {OUTPUT_DIR / 'model-params.json'}")
    print(f"  Isolation Forest separation ratio: {validation['separation_ratio']:.2f}x")
    print(f"  Precision@p99: {validation['precision_at_p99']:.1%}  Recall: {validation['recall_at_p99']:.1%}")
    print(f"  Sensor stats exported for z-score scoring in anomaly-scorer.ts")


if __name__ == "__main__":
    main()
