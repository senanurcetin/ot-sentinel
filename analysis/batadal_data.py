"""BATADAL data access: integrity check, loading, labels and schema validation.

BATADAL (BATtle of the Attack Detection ALgorithms) is a public simulated water-distribution
SCADA benchmark (C-Town): hourly readings of 43 tank levels, pump/valve flows and states, and
junction pressures. Source: https://www.batadal.net/data.html

This code does NOT download anything. The download page was not reachable from the authoring
environment, so an automated downloader could not be verified and was removed. Get the three files
from that page by hand and put them in analysis/data/batadal/; the SHA-256 values pinned below tell
you whether they are the ones this study was run on.

Facts verified against the real files (not assumed):
  * timestamp column ``DATETIME`` formatted ``dd/mm/yy HH``; no gaps, no NaN, no duplicates
  * dataset03: 8761 h, attack-free, ``ATT_FLAG`` is always 0
  * dataset04: 4177 h, 7 attacks; ``ATT_FLAG`` is 1 for only 219 of the 492 attack hours and -999
    ("unknown") everywhere else. There are NO 0 labels, so -999 is not "normal"
  * test file: 2089 h, 7 attacks, shipped as a zip, no label column
  * dataset04 and the test file are rounded to 2 decimals; dataset03 is not
  * dataset04's header and cells carry leading spaces
Ground truth is therefore the published attack intervals in ``batadal_attacks.json``;
``ATT_FLAG`` is only used for a consistency check.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
ATTACKS_FILE = ROOT / "batadal_attacks.json"
TIME_COLUMN = "DATETIME"
LABEL_COLUMN = "ATT_FLAG"
TIME_FORMAT = "%d/%m/%y %H"


@dataclass(frozen=True)
class DatasetFile:
    key: str
    filename: str
    role: str
    # sha256 of the files this study was run on (see analysis/README.md).
    sha256: str | None = None


DATASET_FILES: tuple[DatasetFile, ...] = (
    DatasetFile(
        "normal",
        "BATADAL_dataset03.csv",
        "attack-free training data",
        "8ca6cb851242254d2605b5a53ba3ba5009e2213a545d65396615f1ce0b426e1b",
    ),
    DatasetFile(
        "train",
        "BATADAL_dataset04.csv",
        "partly labelled data containing attacks 1-7",
        "4746beab2cfcdb5e68c7fa197a7522aecb70189d61dcc3eb1f870d2ce387068b",
    ),
    DatasetFile(
        "test",
        "BATADAL_test_dataset.zip",
        "unlabelled test data containing attacks 8-14",
        "27e4a15eca583fca8bf133360866189f50af982899ad18b66dff70fb78d1a6fa",
    ),
)


class SchemaError(ValueError):
    """The file does not look like a BATADAL export."""


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify(path: Path, spec: DatasetFile) -> str:
    """Return the file hash; raise if a pinned checksum does not match."""
    actual = sha256_of(path)
    if spec.sha256 is not None and actual != spec.sha256:
        raise ValueError(f"{path.name}: sha256 {actual} != pinned {spec.sha256}")
    return actual


def _read_csv_bytes(path: Path) -> io.BytesIO:
    if path.suffix.lower() != ".zip":
        return io.BytesIO(path.read_bytes())
    with zipfile.ZipFile(path) as archive:
        members = [n for n in archive.namelist() if n.lower().endswith(".csv")]
        if len(members) != 1:
            raise SchemaError(f"{path.name}: expected exactly one CSV, found {members}")
        return io.BytesIO(archive.read(members[0]))


def load_dataset(path: Path) -> pd.DataFrame:
    """Load a BATADAL CSV (or a zip holding one) into a time-indexed frame.

    Sensor columns are float64. If ``ATT_FLAG`` exists it becomes a nullable ``Int8`` column
    ``flag`` with ``<NA>`` for any value other than 0 or 1 (i.e. -999, "unknown").
    """
    frame = pd.read_csv(_read_csv_bytes(path), skipinitialspace=True)
    frame.columns = [str(c).strip() for c in frame.columns]
    validate_schema(frame, path.name)

    index = pd.to_datetime(frame[TIME_COLUMN].astype(str).str.strip(), format=TIME_FORMAT)
    out = frame.drop(columns=[TIME_COLUMN]).copy()
    out.index = pd.DatetimeIndex(index, name="time")
    if LABEL_COLUMN in out.columns:
        raw = pd.to_numeric(out.pop(LABEL_COLUMN), errors="coerce")
        out["flag"] = raw.where(raw.isin([0, 1])).astype("Int8")
    out = out.sort_index()
    if not out.index.is_unique:
        raise SchemaError(f"{path.name}: duplicate timestamps")
    return out


def validate_schema(frame: pd.DataFrame, name: str = "<frame>") -> None:
    if TIME_COLUMN not in frame.columns:
        raise SchemaError(f"{name}: missing '{TIME_COLUMN}' column (got {list(frame.columns)[:5]})")
    sensors = [c for c in frame.columns if c not in (TIME_COLUMN, LABEL_COLUMN)]
    if not sensors:
        raise SchemaError(f"{name}: no sensor columns")
    non_numeric = [c for c in sensors if not pd.api.types.is_numeric_dtype(frame[c])]
    if non_numeric:
        raise SchemaError(f"{name}: non-numeric sensor columns {non_numeric[:5]}")
    if frame[sensors].isna().any().any():
        raise SchemaError(f"{name}: unexpected missing sensor values")


def feature_columns(reference: pd.DataFrame) -> list[str]:
    """Sensor columns of the attack-free reference, **constant ones included**.

    Seven features (S_PU1, F_PU3, S_PU3, F_PU5, S_PU5, F_PU9, S_PU9) are constant in dataset03.
    Dropping them would hide the most direct evidence for some attacks (e.g. pump PU3 being
    switched on in attacks 10-11 moves F_PU3/S_PU3 away from a constant 0), so they are kept and
    the detectors treat any departure from a constant as maximally anomalous.
    """
    return [c for c in reference.columns if c != "flag"]


def as_matrix(frame: pd.DataFrame, features: list[str]) -> np.ndarray:
    return frame[features].to_numpy(dtype=float)


# ---------------------------------------------------------------------------------------------
# Ground truth: the published attack intervals
# ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Attack:
    id: int
    dataset: str
    start: pd.Timestamp
    end: pd.Timestamp  # inclusive
    duration_hours: int
    description: str
    concealment: str
    labeled_hours: int | None = None


def load_attacks(path: Path = ATTACKS_FILE) -> list[Attack]:
    raw = json.loads(path.read_text(encoding="utf-8"))["attacks"]
    attacks = [
        Attack(
            id=a["id"],
            dataset=a["dataset"],
            start=pd.Timestamp(a["start"]),
            end=pd.Timestamp(a["end"]),
            duration_hours=a["duration_hours"],
            description=a["description"],
            concealment=a["concealment"],
            labeled_hours=a.get("labeled_hours"),
        )
        for a in raw
    ]
    validate_attacks(attacks)
    return attacks


def validate_attacks(attacks: list[Attack]) -> None:
    """Internal consistency of the interval table (also run by the tests)."""
    previous_end = None
    for a in sorted(attacks, key=lambda x: x.start):
        hours = int((a.end - a.start) / pd.Timedelta(hours=1)) + 1  # both endpoints inclusive
        if hours != a.duration_hours:
            raise ValueError(
                f"attack {a.id}: interval spans {hours} h, table says {a.duration_hours}"
            )
        if a.labeled_hours is not None and not 0 <= a.labeled_hours <= a.duration_hours:
            raise ValueError(f"attack {a.id}: labeled_hours out of range")
        if previous_end is not None and a.start <= previous_end:
            raise ValueError(f"attack {a.id} overlaps the previous attack")
        previous_end = a.end


def attack_mask(index: pd.DatetimeIndex, attacks: list[Attack]) -> np.ndarray:
    """True for every timestamp inside any of ``attacks`` (inclusive)."""
    mask = np.zeros(len(index), dtype=bool)
    for a in attacks:
        mask |= (index >= a.start) & (index <= a.end)
    return mask


def attack_ids_at(index: pd.DatetimeIndex, attacks: list[Attack]) -> np.ndarray:
    """Attack id for each timestamp, 0 where there is no attack."""
    ids = np.zeros(len(index), dtype=int)
    for a in attacks:
        ids[(index >= a.start) & (index <= a.end)] = a.id
    return ids


def check_flags_inside_intervals(frame: pd.DataFrame, attacks: list[Attack]) -> dict:
    """ATT_FLAG == 1 rows must all lie inside the published intervals (consistency check)."""
    flagged = frame["flag"].eq(1).to_numpy(dtype=bool, na_value=False)
    inside = attack_mask(frame.index, attacks)
    return {
        "flagged_hours": int(flagged.sum()),
        "flagged_inside_intervals": int((flagged & inside).sum()),
        "interval_hours_in_file": int(inside.sum()),
    }


# Protocol v3, "Explanation accuracy": the signals an attack acts on, read mechanically from the
# official description. Never from the concealment text: concealed signals are replayed to look
# normal.
_TANK = re.compile(r"\b(?:L_)?T(\d)\b")
_PUMP = re.compile(r"\bPU(\d+)\b")
_VALVE = re.compile(r"\bV(\d)\b")
_SAME_AS = re.compile(r"^(?:Like|Similar to) attack (\d+)\b")


def affected_signals(attacks: list[Attack]) -> dict[int, list[str]]:
    """Map each attack id to the SCADA signals its description names.

    Tank ``Tn``/``L_Tn`` -> ``L_Tn``; pump ``PUn`` -> ``F_PUn``, ``S_PUn``;
    valve ``Vn`` -> ``F_Vn``, ``S_Vn``;
    "Like attack N" / "Similar to attack N" -> the signals of attack N.
    """
    by_id = {a.id: a for a in attacks}

    def resolve(attack_id: int, seen: tuple[int, ...] = ()) -> list[str]:
        if attack_id in seen:
            raise ValueError(f"circular 'like attack' reference at attack {attack_id}")
        description = by_id[attack_id].description
        same = _SAME_AS.match(description)
        if same:
            return resolve(int(same.group(1)), (*seen, attack_id))
        signals = {f"L_T{n}" for n in _TANK.findall(description)}
        for n in _PUMP.findall(description):
            signals |= {f"F_PU{n}", f"S_PU{n}"}
        for n in _VALVE.findall(description):
            signals |= {f"F_V{n}", f"S_V{n}"}
        if not signals:
            raise ValueError(f"attack {attack_id}: description names no signal")
        return sorted(signals)

    return {a.id: resolve(a.id) for a in attacks}
