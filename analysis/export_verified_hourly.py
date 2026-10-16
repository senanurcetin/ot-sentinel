"""Regenerate the BATADAL 2016 attack-window artifact from pinned official bytes.

No downloader or invented data. Use the original BATADAL_dataset04.csv obtained
from https://www.batadal.net/data.html (or its publisher's source repository).
The original CSV is NOT checked into this project. Deterministic window export
keeps 12 real hours on either side of each of seven published attack intervals.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

import batadal_data as bd

ROOT = Path(__file__).resolve().parent
ARTIFACT = ROOT.parent / "src/data/batadal-case-study/verified-hourly-dataset04.json"
RESULTS = ROOT.parent / "src/data/batadal-case-study/results.json"
SOURCE = next(spec for spec in bd.DATASET_FILES if spec.key == "train")
PADDING_HOURS = 12
GIT_BLOB = "9582e58fbbfcfc66f3257062b565537b7a965eb3"
SCHEMA = "ot-sentinel/batadal-hourly-source-window/v1"


def validate_hourly_frame(frame: pd.DataFrame, features: list[str], expected_rows: int) -> None:
    if len(frame) != expected_rows:
        raise bd.SchemaError(f"expected {expected_rows} hourly rows, got {len(frame)}")
    if len(frame.columns.drop("flag", errors="ignore")) != 43:
        raise bd.SchemaError("expected exactly 43 source measurements")
    if list(frame.columns.drop("flag", errors="ignore")) != features:
        raise bd.SchemaError("feature names/order differ from the published benchmark")
    if not frame.index.is_monotonic_increasing or not frame.index.is_unique:
        raise bd.SchemaError("timestamps must be strictly ordered and unique")
    if frame.index.tz is not None:
        raise bd.SchemaError("source BATADAL timestamps have no declared timezone")
    if len(frame) > 1 and not (frame.index.to_series().diff().iloc[1:] == pd.Timedelta(hours=1)).all():
        raise bd.SchemaError("non-hourly or gapped chronology")
    if not np.isfinite(frame[features].to_numpy(dtype=float)).all():
        raise bd.SchemaError("nonfinite or missing measurement")


def build_export(frame: pd.DataFrame, expected_features: list[str],
                 attacks: list[bd.Attack], digest: str, total_rows: int) -> dict:
    validate_hourly_frame(frame, expected_features, total_rows)
    train_attacks = [a for a in attacks if a.dataset == "train"]
    if [a.id for a in train_attacks] != list(range(1, 8)):
        raise bd.SchemaError("expected exactly the published attacks 1..7")
    intervals, windows = [], []
    for attack in train_attacks:
        intervals.append({
            "id": attack.id,
            "start": attack.start.strftime("%Y-%m-%dT%H:%M:%S"),
            "end": attack.end.strftime("%Y-%m-%dT%H:%M:%S"),
            "duration_hours": attack.duration_hours,
        })
        start = attack.start - pd.Timedelta(hours=PADDING_HOURS)
        end = attack.end + pd.Timedelta(hours=PADDING_HOURS)
        window = frame.loc[start:end, expected_features]
        expected = attack.duration_hours + PADDING_HOURS * 2
        if len(window) != expected or window.index[0] != start or window.index[-1] != end:
            raise bd.SchemaError(f"attack {attack.id}: missing genuine hourly window samples")
        windows.append({
            "attack_id": attack.id,
            "window_start": start.strftime("%Y-%m-%dT%H:%M:%S"),
            "window_end": end.strftime("%Y-%m-%dT%H:%M:%S"),
            "rows": [
                {
                    "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
                    "values": [float(v) for v in row],
                }
                for timestamp, row in zip(window.index, window.to_numpy(dtype=float))
            ],
        })
    return {
        "schema": SCHEMA,
        "dataset": "dataset04",
        "provenance": {
            "publisher": "BATADAL / scy-phy official source repository",
            "source_url": "https://github.com/scy-phy/www.batadal.net/blob/master/data/BATADAL_dataset04.csv",
            "source_sha256": digest,
            "source_git_blob": GIT_BLOB,
            "pinned_in_repo": "analysis/batadal_data.py",
            "source_total_rows": total_rows,
            "source_time_format": "DD/MM/YY HH",
            "timezone": "unspecified in source (timestamps are not asserted UTC)",
            "note": "Published C-Town simulation measurements, NOT live plant telemetry",
        },
        "feature_names": expected_features,
        "window_padding_hours": PADDING_HOURS,
        "attack_intervals": intervals,
        "windows": windows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True,
                        help="Original publisher BATADAL_dataset04.csv file (required)")
    parser.add_argument("--check", action="store_true",
                        help="Compare exact exported data structure to the committed JSON")
    parser.add_argument("--write", action="store_true",
                        help="Explicitly write/regenerate committed derived JSON")
    args = parser.parse_args()
    if args.check == args.write:
        parser.error("choose exactly one of --check or --write")
    if args.input.name != SOURCE.filename:
        raise bd.SchemaError("use the original BATADAL_dataset04.csv filename")
    digest = bd.verify(args.input, SOURCE)  # hard fail on modified/injected bytes
    # Verify chronology before bd.load_dataset sorts the timestamps.
    raw = pd.read_csv(args.input, skipinitialspace=True, usecols=["DATETIME"])
    source_times = pd.to_datetime(raw.iloc[:, 0].astype(str).str.strip(), format=bd.TIME_FORMAT)
    if not source_times.is_monotonic_increasing or not source_times.is_unique:
        raise bd.SchemaError("source CSV row chronology is altered or duplicated")
    frame = bd.load_dataset(args.input)
    results = json.loads(RESULTS.read_text(encoding="utf-8"))
    expected_features = results["data"]["features"]
    export = build_export(frame, expected_features, bd.load_attacks(),
                          digest, len(frame))
    if args.check:
        committed = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        if export != committed:
            raise SystemExit("FAIL: derived hourly export differs from pinned official CSV")
        print(f"PASS: {len(export['windows'])} verified attack windows, "
              f"{sum(len(w['rows']) for w in export['windows'])} original measured hours")
    else:
        ARTIFACT.write_text(json.dumps(export, ensure_ascii=True, separators=(",", ":"))
                            + "\n", encoding="utf-8")
        print(f"Wrote {ARTIFACT}")


if __name__ == "__main__":
    main()
