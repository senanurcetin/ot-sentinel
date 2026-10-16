"""Verify the original *binary* 2017 BATADAL ZIP and export real held-out hourly windows.

Read-only source acquisition from the publisher's repository. No backup mirror,
synthetic fallback, training, model claims, deployment access or writable token.
--emit-log emits data only after SHA-256 + archive + chronology pass; use only
in a reviewable, deliberately temporary source-verification workflow.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import urllib.request
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
URL = "https://raw.githubusercontent.com/scy-phy/www.batadal.net/master/data/BATADAL_test_dataset.zip"
PINNED = "27e4a15eca583fca8bf133360866189f50af982899ad18b66dff70fb78d1a6fa"
SCHEMA = "ot-sentinel/batadal-hourly-source-window/v1"
PAD = 12


def fetch_pinned_zip() -> bytes:
    req = urllib.request.Request(URL, headers={"User-Agent": "ot-sentinel-research-verifier"})
    with urllib.request.urlopen(req, timeout=35) as response:
        data = response.read(2_000_001)
    if len(data) > 2_000_000:
        raise ValueError("official ZIP exceeds the configured size boundary")
    digest = hashlib.sha256(data).hexdigest()
    if digest != PINNED:
        raise ValueError("official BATADAL 2017 ZIP hash differs from pinned source")
    return data


def load_original_records(source: bytes, features: list[str]):
    if hashlib.sha256(source).hexdigest() != PINNED:
        raise ValueError("source hash does not match the independently pinned 2017 ZIP")
    with zipfile.ZipFile(io.BytesIO(source)) as archive:
        members = [m for m in archive.infolist() if not m.is_dir()]
        if len(members) != 1 or not members[0].filename.lower().endswith(".csv"):
            raise ValueError("expected precisely one uncompressed CSV member")
        if members[0].file_size > 4_000_000:
            raise ValueError("unexpected oversized ZIP member")
        decoded = archive.read(members[0]).decode("utf-8-sig")
    reader = csv.reader(io.StringIO(decoded, newline=""))
    header = [x.strip() for x in next(reader)]
    if header != ["DATETIME", *features]:
        raise ValueError("unlabelled test CSV must contain 43 original sensors in correct order")
    out = []
    for position, cells in enumerate(reader):
        if not cells:
            continue
        if len(cells) != 44:
            raise ValueError(f"row {position}: wrong source column count")
        timestamp = datetime.strptime(cells[0].strip(), "%d/%m/%y %H")
        values = [float(v.strip()) for v in cells[1:]]
        if not all(math.isfinite(value) for value in values):
            raise ValueError("nonfinite original BATADAL test signal")
        if out and timestamp - out[-1][0] != timedelta(hours=1):
            raise ValueError(f"row {position}: missing/duplicate/nonchronological hour")
        out.append((timestamp, values))
    if len(out) != 2089:
        raise ValueError(f"expected 2089 genuine hourly test rows, got {len(out)}")
    return out


def build_verified_test_artifact(source: bytes) -> dict:
    result = json.loads((ROOT.parent / "src/data/batadal-case-study/results.json").read_text())
    features = result["data"]["features"]
    if len(features) != 43 or len(set(features)) != 43:
        raise ValueError("known 43-feature inventory inconsistent")
    records = load_original_records(source, features)
    attack_file = json.loads((ROOT / "batadal_attacks.json").read_text())
    attacks = [a for a in attack_file["attacks"] if a["dataset"] == "test"]
    if [a["id"] for a in attacks] != list(range(8, 15)):
        raise ValueError("published test attack IDs must be 8..14")
    intervals, windows = [], []
    for a in attacks:
        start = datetime.fromisoformat(a["start"])
        end = datetime.fromisoformat(a["end"])
        duration = a["duration_hours"]
        if (end - start) != timedelta(hours=duration - 1):
            raise ValueError("unverified attack interval duration")
        subset = [(t, vals) for t, vals in records
                  if start - timedelta(hours=PAD) <= t <= end + timedelta(hours=PAD)]
        if len(subset) != duration + PAD * 2:
            raise ValueError(f"attack {a['id']}: source window is not complete")
        intervals.append({
            "id": a["id"], "start": start.isoformat(timespec="seconds"),
            "end": end.isoformat(timespec="seconds"), "duration_hours": duration,
        })
        windows.append({
            "attack_id": a["id"],
            "window_start": subset[0][0].isoformat(timespec="seconds"),
            "window_end": subset[-1][0].isoformat(timespec="seconds"),
            "rows": [
                {"timestamp": t.isoformat(timespec="seconds"), "values": vals}
                for t, vals in subset
            ],
        })
    return {
        "schema": SCHEMA,
        "dataset": "test",
        "provenance": {
            "publisher": "BATADAL / scy-phy official source repository",
            "source_url": URL,
            "source_sha256": PINNED,
            "source_git_blob": "17301034d0cb20168a093ba28065163e73d9d8df",
            "pinned_in_repo": "analysis/batadal_data.py",
            "source_total_rows": 2089,
            "source_time_format": "DD/MM/YY HH",
            "timezone": "unspecified in source (timestamps are not asserted UTC)",
            "note": "Published C-Town simulation measurements, NOT live plant telemetry",
        },
        "feature_names": features,
        "window_padding_hours": PAD,
        "attack_intervals": intervals,
        "windows": windows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--emit-log", action="store_true",
                        help="log the verified compact JSON in bounded chunks for manual PR import")
    parser.add_argument("--check", action="store_true",
                        help="compare with the published checked-in derived test JSON")
    args = parser.parse_args()
    if args.emit_log == args.check:
        parser.error("choose exactly one of --emit-log or --check")
    source = fetch_pinned_zip()
    result = build_verified_test_artifact(source)
    text = json.dumps(result, separators=(",", ":"), ensure_ascii=True)
    print("SOURCE_ZIP_SHA256_VALIDATED", PINNED)
    print("RECORDS", sum(len(window["rows"]) for window in result["windows"]))
    if args.check:
        dest = ROOT.parent / "src/data/batadal-case-study/verified-hourly-test.json"
        if json.loads(dest.read_text()) != result:
            raise ValueError("checked-in 2017 hourly artifact does not match genuine test ZIP")
        print("PASS: checked-in 2017 artifact fully matches pinned original bytes")
    else:
        print("BATADAL_ARTIFACT_BEGIN")
        for offset in range(0, len(text), 1500):
            print("BATADAL_CHUNK:" + text[offset:offset + 1500])
        print("BATADAL_ARTIFACT_END")


if __name__ == "__main__":
    main()
