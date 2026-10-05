"""Export the runtime scorer parameters from the trained model statistics.

`src/lib/anomaly-scorer.ts` imports `src/data/model/scorer-params.json`; nothing is copied by
hand. A test (tests/test_export_model.py) fails if the committed artifact drifts from what this
script produces, so Python and TypeScript cannot silently disagree.

    python export_model.py          # rewrite the artifact
    python export_model.py --check  # exit 1 if the committed artifact is stale
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "model-params.json"
TARGET = ROOT.parent / "src" / "data" / "model" / "scorer-params.json"

# Scoring-function constants (owned here, consumed by the TypeScript scorer).
RISK_SCORE_DECAY = 0.25  # risk = round(100 * (1 - exp(-RISK_SCORE_DECAY * composite_z)))
ANOMALY_SCORE_DECAY = 0.15  # anomaly = clip(1 - exp(-ANOMALY_SCORE_DECAY * max_z), 0.01, 0.99)
CRITICAL_RISK_THRESHOLD = 50  # risk >= 50 -> CRITICAL
SENSORS = ("temp", "pressure", "vibration")


def build_params(source: dict) -> dict:
    stats = source["sensor_stats"]
    return {
        "_generated_by": "analysis/export_model.py - do not edit by hand",
        "model": {
            "kind": "zscore-composite",
            "trained_on": "simulated normal operating envelope (analysis/train_anomaly_model.py)",
            "n_normal_samples": source["training_config"]["n_normal_samples"],
        },
        "sensors": {
            name: {
                "mean": stats[name]["mean"],
                "std": stats[name]["std"],
                "z_warning": stats[name]["z_threshold_warning"],
                "z_critical": stats[name]["z_threshold_critical"],
                "weight": source["sensor_weights"][name],
            }
            for name in SENSORS
        },
        "risk_score_decay": RISK_SCORE_DECAY,
        "anomaly_score_decay": ANOMALY_SCORE_DECAY,
        "critical_risk_threshold": CRITICAL_RISK_THRESHOLD,
    }


def render(params: dict) -> str:
    return json.dumps(params, indent=2) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    expected = render(build_params(json.loads(SOURCE.read_text(encoding="utf-8"))))
    if args.check:
        current = TARGET.read_text(encoding="utf-8") if TARGET.exists() else ""
        if current != expected:
            print(f"{TARGET} is stale; run python export_model.py", file=sys.stderr)
            return 1
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(expected, encoding="utf-8")
    print(f"wrote {TARGET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
