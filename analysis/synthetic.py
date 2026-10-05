"""BATADAL-shaped SYNTHETIC data for tests and the pipeline smoke mode.

This is NOT BATADAL and nothing measured on it is a result. It exists so the pipeline,
loader and metrics can be exercised in CI without network access or redistributing data.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

N_SENSORS = 8


def _signal(n: int, rng: np.random.Generator, start: pd.Timestamp) -> pd.DataFrame:
    hours = np.arange(n)
    cols = {}
    for i in range(N_SENSORS):
        daily = np.sin(2 * np.pi * (hours % 24) / 24 + i)
        cols[f"S_{i + 1}"] = 10 * (i + 1) + 2 * daily + rng.normal(0, 0.5, n)
    cols["CONST"] = np.full(n, 1.0)
    return pd.DataFrame(cols, index=pd.date_range(start, periods=n, freq="h", name="time"))


def make_synthetic(
    n_normal: int = 2000,
    n_attack: int = 1200,
    n_events: int = 4,
    seed: int = 7,
) -> dict[str, pd.DataFrame]:
    """Return {'normal': ..., 'attack': ...} frames with the loader's output layout."""
    rng = np.random.default_rng(seed)
    normal = _signal(n_normal, rng, pd.Timestamp("2014-01-06"))

    attack = _signal(n_attack, rng, normal.index[-1] + pd.Timedelta(hours=1))
    label = np.zeros(n_attack, dtype=int)
    slot = n_attack // (n_events + 1)
    for k in range(n_events):
        start = slot * (k + 1) + int(rng.integers(0, 20))
        length = int(rng.integers(24, 48))
        cols = rng.choice(N_SENSORS, size=3, replace=False)
        for c in cols:
            attack.iloc[start : start + length, c] += 8.0
        label[start : start + length] = 1
    attack["label"] = pd.array(label, dtype="Int8")
    return {"normal": normal, "attack": attack}


def write_csv(frame: pd.DataFrame, path: Path, unlabelled_prefix: int = 0) -> None:
    """Write in the assumed BATADAL layout: DATETIME dd/mm/yy HH, ATT_FLAG, -999 = unlabelled."""
    out = frame.copy()
    out.insert(0, "DATETIME", out.index.strftime("%d/%m/%y %H"))
    if "label" in out.columns:
        flag = out.pop("label").astype(int)
        flag.iloc[:unlabelled_prefix] = -999
        out["ATT_FLAG"] = flag
    out.to_csv(path, index=False)
