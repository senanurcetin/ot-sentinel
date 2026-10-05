"""BATADAL data access: download, integrity check, loading and schema validation.

BATADAL (BATtle of the Attack Detection ALgorithms) is a public water-distribution SCADA
benchmark: hourly sensor readings, with a labelled attack column in the labelled files.
Source: https://www.batadal.net/data.html

ASSUMPTIONS (unverified at the time of writing - the authoring environment could not reach
batadal.net). They are isolated here so the first real run only has to touch this file:
  * a timestamp column named ``DATETIME`` (day-first, hourly)
  * a binary label column named ``ATT_FLAG`` where values other than 0/1 (e.g. -999) mean
    "unlabelled"
  * every other numeric column is a sensor/actuator reading
`validate_schema` fails loudly instead of guessing when these do not hold.
"""

from __future__ import annotations

import hashlib
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

BASE_URL = "https://www.batadal.net/data"
TIME_COLUMN = "DATETIME"
LABEL_COLUMN = "ATT_FLAG"


@dataclass(frozen=True)
class DatasetFile:
    key: str
    filename: str
    role: str
    # Pinned on the first real download (`run_batadal_case_study.py --pin-checksums`).
    sha256: str | None = None


DATASET_FILES: tuple[DatasetFile, ...] = (
    DatasetFile("normal", "BATADAL_dataset03.csv", "attack-free training data"),
    DatasetFile("attack", "BATADAL_dataset04.csv", "labelled data containing attacks"),
    DatasetFile("test", "BATADAL_test_dataset.csv", "held-out test data (labels may be absent)"),
)


class SchemaError(ValueError):
    """The file does not look like a BATADAL export."""


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(dest_dir: Path, files: tuple[DatasetFile, ...] = DATASET_FILES) -> list[Path]:
    """Download any missing files into ``dest_dir``. Raw data is never committed."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for spec in files:
        target = dest_dir / spec.filename
        if not target.exists():
            urllib.request.urlretrieve(f"{BASE_URL}/{spec.filename}", target)  # noqa: S310
        verify(target, spec)
        paths.append(target)
    return paths


def verify(path: Path, spec: DatasetFile) -> str:
    """Return the file hash; raise if a pinned checksum does not match."""
    actual = sha256_of(path)
    if spec.sha256 is not None and actual != spec.sha256:
        raise ValueError(f"{path.name}: sha256 {actual} != pinned {spec.sha256}")
    return actual


def _parse_time(raw: pd.Series) -> pd.Series:
    try:
        return pd.to_datetime(raw.str.strip(), format="%d/%m/%y %H", errors="raise")
    except (ValueError, TypeError):
        return pd.to_datetime(raw.str.strip(), dayfirst=True, errors="raise")


def load_dataset(path: Path) -> pd.DataFrame:
    """Load a BATADAL CSV into a time-indexed frame.

    The label column (if present) becomes a nullable ``Int8`` column ``label`` with
    ``<NA>`` for unlabelled rows; sensor columns are float64.
    """
    frame = pd.read_csv(path, skipinitialspace=True)
    frame.columns = [str(c).strip() for c in frame.columns]
    validate_schema(frame, path.name)

    index = pd.DatetimeIndex(_parse_time(frame[TIME_COLUMN].astype(str)), name="time")
    out = frame.drop(columns=[TIME_COLUMN]).copy()
    out.index = index
    if LABEL_COLUMN in out.columns:
        raw = pd.to_numeric(out.pop(LABEL_COLUMN), errors="coerce")
        out["label"] = raw.where(raw.isin([0, 1])).astype("Int8")
    return out.sort_index()


def validate_schema(frame: pd.DataFrame, name: str = "<frame>") -> None:
    if TIME_COLUMN not in frame.columns:
        raise SchemaError(f"{name}: missing '{TIME_COLUMN}' column (got {list(frame.columns)[:5]})")
    sensors = [c for c in frame.columns if c not in (TIME_COLUMN, LABEL_COLUMN)]
    if not sensors:
        raise SchemaError(f"{name}: no sensor columns")
    non_numeric = [c for c in sensors if not pd.api.types.is_numeric_dtype(frame[c])]
    if non_numeric:
        raise SchemaError(f"{name}: non-numeric sensor columns {non_numeric[:5]}")


def feature_columns(frame: pd.DataFrame) -> list[str]:
    """Sensor columns, excluding the label and any constant (zero-variance) column."""
    cols = [c for c in frame.columns if c != "label"]
    return [c for c in cols if frame[c].nunique(dropna=True) > 1]


def common_features(*frames: pd.DataFrame) -> list[str]:
    """Features present in (and non-constant in) the first frame, shared by all frames."""
    shared = set(frames[0].columns).intersection(*[set(f.columns) for f in frames[1:]])
    return [c for c in feature_columns(frames[0]) if c in shared]


def as_matrix(frame: pd.DataFrame, features: list[str]) -> np.ndarray:
    return frame[features].to_numpy(dtype=float)
