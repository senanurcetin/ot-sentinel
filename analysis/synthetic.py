"""BATADAL-shaped SYNTHETIC data for tests and the pipeline smoke mode.

This is NOT BATADAL and nothing measured on it is a result. It reproduces the *format* of the real
files (header spaces, a label column holding only 1 and -999, a zipped unlabelled test file, a
feature that is constant in the reference and moves during one attack) so the loader, the
interval ground truth and the protocol can be exercised in CI without the dataset.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

import batadal_data as bd

N_SENSORS = 8


def _signal(n: int, rng: np.random.Generator, start: pd.Timestamp) -> pd.DataFrame:
    hours = np.arange(n)
    cols = {}
    for i in range(N_SENSORS):
        daily = np.sin(2 * np.pi * (hours % 24) / 24 + i)
        cols[f"S_{i + 1}"] = 10 * (i + 1) + 2 * daily + rng.normal(0, 0.5, n)
    cols["CONST"] = np.full(n, 1.0)  # constant everywhere, like S_PU1
    cols["PUMP"] = np.zeros(n)  # constant in the reference; attacks switch it on, like F_PU3
    return pd.DataFrame(cols, index=pd.date_range(start, periods=n, freq="h", name="time"))


def _attack(frame: pd.DataFrame, attack_id: int, dataset: str, start: int, hours: int, kind: str):
    """Perturb ``frame`` in place and return the matching Attack."""
    end = start + hours - 1
    if kind == "shift":
        frame.iloc[start : end + 1, 0:3] += 8.0
    elif kind == "pump":  # visible only through a feature that is constant in the reference
        frame.iloc[start : end + 1, frame.columns.get_loc("PUMP")] = 30.0
    return bd.Attack(
        id=attack_id,
        dataset=dataset,
        start=frame.index[start],
        end=frame.index[end],
        duration_hours=hours,
        description=f"synthetic {kind} attack",
        concealment="",
        labeled_hours=hours // 2 if dataset == "train" else None,
    )


def make_synthetic(
    n_normal: int = 2000, n_train: int = 1500, n_test: int = 1200, seed: int = 7
) -> tuple[dict[str, pd.DataFrame], list[bd.Attack]]:
    """Return ({'normal','train','test'} frames, attacks) in the loader's output layout."""
    rng = np.random.default_rng(seed)
    normal = _signal(n_normal, rng, pd.Timestamp("2014-01-06"))
    normal["flag"] = pd.array(np.zeros(n_normal, dtype=int), dtype="Int8")

    train = _signal(n_train, rng, pd.Timestamp("2016-07-04"))
    test = _signal(n_test, rng, pd.Timestamp("2017-01-04"))
    attacks = [
        _attack(train, 1, "train", 300, 40, "shift"),
        _attack(train, 2, "train", 700, 30, "shift"),
        _attack(train, 3, "train", 1100, 36, "pump"),
        _attack(test, 4, "test", 250, 40, "shift"),
        _attack(test, 5, "test", 600, 30, "pump"),
        _attack(test, 6, "test", 950, 36, "shift"),
    ]
    # Like the real dataset04: 1 on the labelled hours, -999 ("unknown") on everything else.
    flag = np.full(n_train, pd.NA, dtype=object)
    for a in (x for x in attacks if x.dataset == "train"):
        first = train.index.get_loc(a.start)
        flag[first : first + (a.labeled_hours or 0)] = 1
    train["flag"] = pd.array(flag, dtype="Int8")
    return {"normal": normal, "train": train, "test": test}, attacks


def write_files(frames: dict[str, pd.DataFrame], directory: Path) -> None:
    """Write the frames in the real on-disk layout under the real file names."""

    def to_csv(frame: pd.DataFrame, with_flag: bool, pad: bool) -> str:
        out = frame.drop(columns=["flag"], errors="ignore").copy()
        if pad:
            out = out.round(2)
        out.insert(0, "DATETIME", out.index.strftime(bd.TIME_FORMAT))
        if with_flag:
            out["ATT_FLAG"] = frame["flag"].astype("float").fillna(-999).astype(int)
        text = out.to_csv(index=False)
        if pad:  # dataset04 has leading spaces in header cells and values
            lines = text.splitlines()
            lines = [lines[0].replace(",", ", ")] + [ln.replace(",", ", ") for ln in lines[1:]]
            text = "\n".join(lines) + "\n"
        return text

    directory.mkdir(parents=True, exist_ok=True)
    (directory / "BATADAL_dataset03.csv").write_text(to_csv(frames["normal"], True, False))
    (directory / "BATADAL_dataset04.csv").write_text(to_csv(frames["train"], True, True))
    with zipfile.ZipFile(directory / "BATADAL_test_dataset.zip", "w") as archive:
        archive.writestr("BATADAL_test_dataset.csv", to_csv(frames["test"], False, True))


def write_attacks(attacks: list[bd.Attack], path: Path) -> None:
    """Persist synthetic attacks in the same JSON layout as batadal_attacks.json."""
    import json

    rows = [
        {
            "id": a.id,
            "dataset": a.dataset,
            "start": a.start.strftime("%Y-%m-%dT%H"),
            "end": a.end.strftime("%Y-%m-%dT%H"),
            "duration_hours": a.duration_hours,
            "description": a.description,
            "concealment": a.concealment,
            **({"labeled_hours": a.labeled_hours} if a.labeled_hours is not None else {}),
        }
        for a in attacks
    ]
    path.write_text(json.dumps({"attacks": rows}, indent=2))
