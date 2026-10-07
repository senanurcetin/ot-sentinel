"""Reproduce the OT-Sentinel anomaly-detection case study on BATADAL.

PROTOCOL v2 - fixed before any detection result was looked at:
  * Ground truth is the set of published attack intervals (batadal_attacks.json). The files' own
    ATT_FLAG column cannot serve: in dataset04 it is 1 for 219 of 492 attack hours and -999
    ("unknown") everywhere else, with no 0 labels.
  * Unsupervised detectors learn from the first 80 % of attack-free dataset03 (chronological).
    The last 20 % of dataset03 is used ONLY to set each detector's alarm threshold: the lowest
    threshold with at most MAX_FALSE_ALARMS_PER_DAY alarm segments per attack-free day. Every
    detector faces the same budget and no attack label can influence a threshold.
  * Two evaluations, reported separately:
      - TEST (attacks 8-14, Jan-Mar 2017, later in time than anything the detectors saw): the
        headline result.
      - TRAIN = dataset04 (attacks 1-7, Jul-Dec 2016): secondary.
  * The supervised reference is trained on dataset04 with the interval labels and is evaluated on
    TEST only, never on the data it was trained on.
  * Alarm = score STRICTLY above the threshold. (Amendment, see below.)
  * Nothing is tuned on either evaluation set. Metrics: events detected, hours to detect (from
    the published start), false-alarm segments per attack-free day, point-wise PR-AUC, and a
    per-attack table (with 7 events per set, "n of 7" is the honest unit, not a percentage).

AMENDMENT after the first run (the first run's numbers are not used anywhere): it showed the static-
limit detector alarming permanently (alarm fraction 1.0, "0 false alarms, 7/7 detected, 0 h to
detect"), because the budget counted alarm SEGMENTS and a permanent alarm is one segment, and
because `score >= threshold` let a threshold sit on the constant floor of that detector's scores.
Fixed by (1) strict `score > threshold` and (2) always reporting the false-alarm HOUR fraction and
the number of attacks expected to be "detected" by false alarms alone. No detector, feature,
split or budget was changed.

PROTOCOL v3 (docs/protocol-v3.md, committed before the first v3 run) keeps everything above and
adds three causal temporal detectors with fixed textbook parameters, day-block bootstrap intervals,
a paired PR-AUC comparison with zscore_max, explanation accuracy (do the top-3 features of an
alarm include a signal the attack description names?), and a decision rule stated in advance.

Usage:
  python run_batadal_case_study.py --data-dir data/batadal   # run on the real files
  python run_batadal_case_study.py --synthetic               # pipeline smoke test; NOT a result
  python run_batadal_case_study.py --pin-checksums           # print sha256 of the files on disk
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn

import batadal_data as bd
from detectors import default_detectors
from metrics import (
    calibrate_threshold,
    day_block_bootstrap,
    event_metrics,
    explanation_accuracy,
    per_attack,
    point_metrics,
)

ROOT = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = ROOT / "data" / "batadal"
DEFAULT_OUT_DIR = ROOT.parent / "src" / "data" / "batadal-case-study"
SMOKE_OUT_DIR = ROOT / "artifacts" / "synthetic-smoke"

NORMAL_FIT_FRACTION = 0.8
MAX_FALSE_ALARMS_PER_DAY = 1.0
PROTOCOL_VERSION = 3
V3_DETECTORS = ("ewma_z", "cusum", "rolling_residual")
COMPARISON_REFERENCE = "zscore_max"
N_BOOTSTRAP = 1000
EXPLANATION_TOP_K = 3

LIMITATIONS = [
    "Event recall is easy to inflate: with about one false-alarm segment a day, an attack of 30 to "
    "110 hours contains an alarm by chance most of the time. Read events_detected next to "
    "expected_events_detected_by_chance and false_alarm_hour_fraction.",
    "Only 7 attack events per evaluation set: a single missed or caught attack moves recall by "
    "14 points, so differences between detectors are anecdotal, not statistically established.",
    "BATADAL is a simulation of one water-distribution network (C-Town); results do not "
    "transfer to real plants or to protocol-level attacks.",
    "The attack-free reference is from 2014 while the evaluation sets are from 2016 and 2017. "
    "Operating conditions shifted (see drift), so part of every detector's false-alarm rate is "
    "distribution shift, not detector quality.",
    "dataset04 and the test file are rounded to 2 decimals; dataset03, the reference, is not.",
    "Time-to-detect counts from the published attack start. For attacks that conceal themselves "
    "with a replay of normal readings, the sensor-visible effect can begin later.",
    "The supervised reference sees labelled attacks of the same simulator and is an optimistic "
    "comparison, not a deployable detector. It is trained on dataset04 only.",
    "The runtime scorer in src/lib/anomaly-scorer.ts is a 3-sensor demo; this study evaluates the "
    "same z-score method on all 43 BATADAL signals, not that runtime code.",
    "Protocol v3 was written after the v2 results were known. Its parameters are textbook "
    "defaults fixed in advance and nothing was tuned on labelled data, but it is a follow-up "
    "analysis, not a strict pre-registration. With seven detectors, one of them looks best by "
    "chance; the decision rule therefore uses a paired bootstrap interval, not point estimates.",
    "Explanation accuracy only checks whether an alarm's top-3 signals include equipment the "
    "attack description names. Attacks that replay normal readings hide exactly those signals, "
    "so a low rate there is expected and does not mean the alarm is spurious.",
]


def _round(obj):
    if isinstance(obj, dict):
        return {k: _round(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_round(v) for v in obj]
    if isinstance(obj, float):
        return round(obj, 4)
    return obj


def drift_diagnostic(reference: pd.DataFrame, evaluation: pd.DataFrame, normal_mask, features):
    """Descriptive only: share of attack-free evaluation hours outside the reference min/max."""
    normal = evaluation.loc[~np.asarray(normal_mask), features]
    lo, hi = reference[features].min(), reference[features].max()
    outside = (normal < lo) | (normal > hi)
    share = outside.mean().sort_values(ascending=False)
    return {
        "normal_hours": int(len(normal)),
        "share_of_hours_with_any_feature_outside_reference_range": float(
            outside.any(axis=1).mean()
        ),
        "top_features_share_of_hours_outside_reference_range": {
            k: float(v) for k, v in share.head(5).items() if v > 0
        },
    }


def _evaluate(name_scores, y, ids, contributions, affected):
    out = {}
    for name, (supervised, threshold, score) in name_scores.items():
        alarm = score > threshold
        contrib = contributions.get(name)
        out[name] = {
            "supervised": supervised,
            "threshold": threshold,
            "point": point_metrics(y.astype(int), score, threshold),
            "event": event_metrics(y.astype(int), alarm),
            "per_attack": per_attack(ids, alarm),
            # None for detectors without a per-feature score (Isolation Forest, gradient boosting)
            "explanation": (
                explanation_accuracy(contrib, alarm, ids, affected, EXPLANATION_TOP_K)
                if contrib is not None
                else None
            ),
        }
    return out


def _decision(bootstrap: dict) -> dict:
    """Protocol v3 decision rule: better than the reference only if the paired PR-AUC difference
    interval on the test file lies entirely above 0."""
    out = {}
    for name in V3_DETECTORS:
        diff = bootstrap["intervals"].get(name, {}).get("pr_auc_diff")
        out[name] = {
            "pr_auc_diff_interval": diff,
            "better_than_reference": bool(diff is not None and diff[0] > 0),
        }
    return {"reference": COMPARISON_REFERENCE, "evaluated_on": "test", "detectors": out}


def run_case_study(
    frames: dict[str, pd.DataFrame],
    attacks: list[bd.Attack],
    data_source: str,
    max_false_alarms_per_day: float = MAX_FALSE_ALARMS_PER_DAY,
    seed: int = 42,
) -> dict:
    normal, train, test = frames["normal"], frames["train"], frames["test"]
    train_attacks = [a for a in attacks if a.dataset == "train"]
    test_attacks = [a for a in attacks if a.dataset == "test"]
    if not train_attacks or not test_attacks:
        raise ValueError("need attacks for both the train and the test set")

    features = bd.feature_columns(normal)
    for name, frame in (("train", train), ("test", test)):
        missing = [c for c in features if c not in frame.columns]
        if missing:
            raise bd.SchemaError(f"{name} data lacks features {missing[:5]}")

    split = int(len(normal) * NORMAL_FIT_FRACTION)
    x_fit = bd.as_matrix(normal.iloc[:split], features)
    x_cal = bd.as_matrix(normal.iloc[split:], features)

    column = {name: i for i, name in enumerate(features)}
    affected = {
        attack_id: [column[s] for s in signals if s in column]
        for attack_id, signals in bd.affected_signals(attacks).items()
    }

    sets = {}
    for name, frame, atk in (("test", test, test_attacks), ("train", train, train_attacks)):
        sets[name] = {
            "x": bd.as_matrix(frame, features),
            "y": bd.attack_mask(frame.index, atk),
            "ids": bd.attack_ids_at(frame.index, atk),
            "days": np.asarray(frame.index.normalize()),
        }
    if not sets["train"]["y"].any() or not sets["test"]["y"].any():
        raise ValueError("an evaluation set contains no attack hours; check the interval table")

    scored: dict[str, dict] = {"test": {}, "train": {}}
    contributions: dict[str, dict] = {"test": {}, "train": {}}
    thresholds = {}
    for detector in default_detectors(seed):
        if detector.supervised:
            detector.fit(sets["train"]["x"], sets["train"]["y"].astype(int))
        else:
            detector.fit(x_fit)
        threshold = calibrate_threshold(detector.score(x_cal), max_false_alarms_per_day)
        thresholds[detector.name] = threshold
        for set_name, data in sets.items():
            if detector.supervised and set_name == "train":
                continue  # never evaluate a model on the data it was trained on
            scored[set_name][detector.name] = (
                detector.supervised,
                threshold,
                detector.score(data["x"]),
            )
            if hasattr(detector, "contributions"):
                contributions[set_name][detector.name] = detector.contributions(data["x"])

    evaluations = {}
    for set_name, data in sets.items():
        evaluations[set_name] = {
            "attacks": len(set(data["ids"][data["ids"] > 0].tolist())),
            "attack_hours": int(data["y"].sum()),
            "attack_free_hours": int((~data["y"]).sum()),
            "detectors": _evaluate(
                scored[set_name], data["y"], data["ids"], contributions[set_name], affected
            ),
            "bootstrap": day_block_bootstrap(
                data["y"].astype(int),
                {n: (score, thr) for n, (_, thr, score) in scored[set_name].items()},
                data["days"],
                reference=COMPARISON_REFERENCE,
                n_boot=N_BOOTSTRAP,
                seed=seed,
            ),
        }
    evaluations["train"]["not_evaluated"] = [
        d.name for d in default_detectors(seed) if d.supervised
    ]

    return _round(
        {
            "data_source": data_source,
            "protocol": {
                "version": PROTOCOL_VERSION,
                "document": "docs/protocol-v3.md",
                "temporal_detectors": {
                    "ewma_z": {"lambda": 0.2},
                    "cusum": {"k": 0.5},
                    "rolling_residual": {"window_hours": 24},
                },
                "explanation_top_k": EXPLANATION_TOP_K,
                "ground_truth": "published attack intervals (batadal_attacks.json)",
                "headline_evaluation": "test",
                "max_false_alarms_per_day": max_false_alarms_per_day,
                "normal_fit_fraction": NORMAL_FIT_FRACTION,
                "threshold_source": "last 20 % of attack-free dataset03 only",
                "supervised_trained_on": "dataset04 (interval labels); evaluated on test only",
                "seed": seed,
                "scikit_learn": sklearn.__version__,
            },
            "data": {
                "reference_rows": len(normal),
                "reference_fit_rows": split,
                "reference_calibration_rows": len(normal) - split,
                "n_features": len(features),
                "constant_features_in_reference": [c for c in features if normal[c].nunique() <= 1],
                "features": features,
            },
            "evaluations": evaluations,
            "decision": _decision(evaluations["test"]["bootstrap"]),
            "affected_signals": {str(k): v for k, v in bd.affected_signals(attacks).items()},
            "drift": {
                "test": drift_diagnostic(normal, test, sets["test"]["y"], features),
                "train": drift_diagnostic(normal, train, sets["train"]["y"], features),
            },
            "limitations": LIMITATIONS,
        }
    )


def load_frames(data_dir: Path) -> dict[str, pd.DataFrame]:
    frames = {}
    for spec in bd.DATASET_FILES:
        path = data_dir / spec.filename
        bd.verify(path, spec)
        frames[spec.key] = bd.load_dataset(path)
    return frames


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--out-dir", type=Path, default=None)
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--pin-checksums", action="store_true")
    parser.add_argument("--max-false-alarms-per-day", type=float, default=MAX_FALSE_ALARMS_PER_DAY)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args(argv)

    if args.pin_checksums:
        for spec in bd.DATASET_FILES:
            path = args.data_dir / spec.filename
            if path.exists():
                print(f'{spec.filename}: "{bd.sha256_of(path)}"')
        return 0

    if args.synthetic:
        from synthetic import make_synthetic

        frames, attacks = make_synthetic(seed=args.seed)
        source = "synthetic-smoke-test (NOT BATADAL)"
        out_dir = args.out_dir or SMOKE_OUT_DIR
    else:
        missing = [
            s.filename for s in bd.DATASET_FILES if not (args.data_dir / s.filename).exists()
        ]
        if missing:
            print(
                f"BATADAL files not found in {args.data_dir}: {missing}. Place them there "
                "(see analysis/README.md).",
                file=sys.stderr,
            )
            return 2
        frames, attacks = load_frames(args.data_dir), bd.load_attacks()
        source = "BATADAL (batadal.net)"
        out_dir = args.out_dir or DEFAULT_OUT_DIR
        flags = bd.check_flags_inside_intervals(
            frames["train"], [a for a in attacks if a.dataset == "train"]
        )
        if flags["flagged_hours"] != flags["flagged_inside_intervals"]:
            print(f"ATT_FLAG rows outside the published intervals: {flags}", file=sys.stderr)
            return 3

    results = run_case_study(frames, attacks, source, args.max_false_alarms_per_day, args.seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "results.json"
    target.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {target}")
    for set_name in ("test", "train"):
        ev = results["evaluations"][set_name]
        print(
            f"[{set_name}] {ev['attacks']} attacks, {ev['attack_hours']} attack h, "
            f"{ev['attack_free_hours']} normal h"
        )
        for name, res in ev["detectors"].items():
            e = res["event"]
            print(
                f"  {name:24s} detected {e['events_detected']}/{e['n_events']}  "
                f"median TTD {e['median_time_to_detect_h']}  FA/day {e['false_alarms_per_day']}  "
                f"alarm hrs(normal) {e['false_alarm_hour_fraction']}  "
                f"by-chance {e['expected_events_detected_by_chance']}  "
                f"PR-AUC {res['point']['pr_auc']}"
            )
    return 0


if __name__ == "__main__":
    np.seterr(divide="raise", invalid="raise")
    sys.exit(main())
