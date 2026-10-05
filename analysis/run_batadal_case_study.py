"""Reproduce the OT-Sentinel anomaly-detection case study.

Protocol (fixed before looking at any result):
  1. Attack-free data is split chronologically 80/20: the head fits the unsupervised detectors,
     the tail is used ONLY to set each detector's alarm threshold so that every detector
     faces the same false-alarm budget (alarms per attack-free day).
  2. The labelled file is split chronologically at an attack-free point. The first half trains
     the supervised reference; every detector is evaluated on the second half.
  3. Metrics are event-level (detected events, time-to-detect, false alarms per day) plus
     point-wise PR-AUC. Nothing is tuned on the evaluation half.

Usage:
  python run_batadal_case_study.py --download            # fetch the public files, then run
  python run_batadal_case_study.py --data-dir path/      # use files already on disk
  python run_batadal_case_study.py --synthetic           # pipeline smoke test; NOT a result
  python run_batadal_case_study.py --pin-checksums       # print sha256 of the files on disk
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
    event_metrics,
    point_metrics,
    split_index_outside_event,
)

ROOT = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = ROOT / "data" / "batadal"
DEFAULT_OUT_DIR = ROOT.parent / "src" / "data" / "batadal-case-study"
SMOKE_OUT_DIR = ROOT / "artifacts" / "synthetic-smoke"

LIMITATIONS = [
    "BATADAL is a simulation of one water-distribution network with a small number of attacks; "
    "event-level numbers rest on few events and carry wide uncertainty.",
    "Thresholds are calibrated on attack-free data from a different file than the evaluation "
    "data, so drift between files is part of the measured false-alarm rate.",
    "The supervised reference sees labelled attacks of the same simulator and is an optimistic "
    "comparison, not a deployable detector.",
    "Results describe detection on hourly aggregates, not real PLC traffic or protocol attacks.",
]


def _round(obj):
    if isinstance(obj, dict):
        return {k: _round(v) for k, v in obj.items()}
    if isinstance(obj, float):
        return round(obj, 4)
    return obj


def labelled_part(frame: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Rows with a 0/1 label, plus how many unlabelled rows were dropped."""
    if "label" not in frame.columns:
        return frame.iloc[0:0], len(frame)
    mask = frame["label"].notna()
    return frame[mask], int((~mask).sum())


def run_case_study(
    frames: dict[str, pd.DataFrame],
    data_source: str,
    max_false_alarms_per_day: float = 1.0,
    seed: int = 42,
) -> dict:
    normal = frames["normal"]
    attack, dropped = labelled_part(frames["attack"])
    if attack.empty or attack["label"].sum() == 0:
        raise ValueError("the labelled file contains no attack events")

    features = bd.common_features(normal, attack)
    split = int(len(normal) * 0.8)
    x_fit = bd.as_matrix(normal.iloc[:split], features)
    x_cal = bd.as_matrix(normal.iloc[split:], features)

    y_all = attack["label"].to_numpy(dtype=int)
    cut = split_index_outside_event(y_all, 0.5)
    x_train, y_train = bd.as_matrix(attack.iloc[:cut], features), y_all[:cut]
    x_eval, y_eval = bd.as_matrix(attack.iloc[cut:], features), y_all[cut:]
    if y_eval.sum() == 0 or y_train.sum() == 0:
        raise ValueError("train/eval halves must each contain at least one attack event")

    results = {}
    for detector in default_detectors(seed):
        if detector.supervised:
            detector.fit(x_train, y_train)
        else:
            detector.fit(x_fit)
        threshold = calibrate_threshold(detector.score(x_cal), max_false_alarms_per_day)
        score = detector.score(x_eval)
        results[detector.name] = {
            "supervised": detector.supervised,
            "threshold": threshold,
            "point": point_metrics(y_eval, score, threshold),
            "event": event_metrics(y_eval, score >= threshold),
        }

    return _round(
        {
            "data_source": data_source,
            "config": {
                "max_false_alarms_per_day": max_false_alarms_per_day,
                "seed": seed,
                "normal_fit_fraction": 0.8,
                "labelled_split_fraction": 0.5,
                "n_features": len(features),
                "scikit_learn": sklearn.__version__,
            },
            "data": {
                "normal_fit_rows": split,
                "normal_calibration_rows": len(normal) - split,
                "labelled_train_rows": int(cut),
                "labelled_eval_rows": int(len(y_eval)),
                "eval_attack_rows": int(y_eval.sum()),
                "unlabelled_rows_dropped": dropped,
                "features": features,
            },
            "detectors": results,
            "limitations": LIMITATIONS,
        }
    )


def load_frames(data_dir: Path) -> dict[str, pd.DataFrame]:
    frames = {}
    for spec in bd.DATASET_FILES:
        path = data_dir / spec.filename
        if spec.key == "test" and not path.exists():
            continue
        bd.verify(path, spec)
        frames[spec.key] = bd.load_dataset(path)
    return frames


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--out-dir", type=Path, default=None)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--pin-checksums", action="store_true")
    parser.add_argument("--max-false-alarms-per-day", type=float, default=1.0)
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

        frames, source = make_synthetic(seed=args.seed), "synthetic-smoke-test (NOT BATADAL)"
        out_dir = args.out_dir or SMOKE_OUT_DIR
    else:
        if args.download:
            bd.download(args.data_dir)
        if not (args.data_dir / bd.DATASET_FILES[0].filename).exists():
            print(
                f"BATADAL files not found in {args.data_dir}. Run with --download, "
                "or place the CSVs there (see analysis/README.md).",
                file=sys.stderr,
            )
            return 2
        frames, source = load_frames(args.data_dir), "BATADAL (batadal.net)"
        out_dir = args.out_dir or DEFAULT_OUT_DIR

    results = run_case_study(frames, source, args.max_false_alarms_per_day, args.seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / "results.json"
    target.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {target}")
    for name, res in results["detectors"].items():
        ev = res["event"]
        print(
            f"{name:24s} events {ev['events_detected']}/{ev['n_events']}  "
            f"ttd(med) {ev['median_time_to_detect_h']}  FA/day {ev['false_alarms_per_day']}  "
            f"PR-AUC {res['point']['pr_auc']}"
        )
    return 0


if __name__ == "__main__":
    np.seterr(all="raise")
    sys.exit(main())
