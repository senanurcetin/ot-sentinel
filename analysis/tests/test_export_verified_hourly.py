"""Checks for the real BATADAL source-window exporter (synthetic unit-only frames)."""
import json

import numpy as np
import pandas as pd
import pytest

import batadal_data as bd
from export_verified_hourly import (
    ARTIFACT, RESULTS, SOURCE, build_export, validate_hourly_frame,
)


def fixture_frame():
    features = json.loads(RESULTS.read_text(encoding="utf-8"))["data"]["features"]
    index = pd.date_range("2016-07-04", periods=4177, freq="h")
    # Unit fixtures only: this generated array is NEVER written as benchmark evidence.
    values = np.tile(np.arange(43, dtype=float), (4177, 1))
    frame = pd.DataFrame(values, columns=features, index=index)
    frame.index.name = "time"
    return frame, features


def test_committed_source_provenance_and_genuine_attack_windows():
    actual = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    assert actual["schema"] == "ot-sentinel/batadal-hourly-source-window/v1"
    assert actual["provenance"]["source_sha256"] == SOURCE.sha256
    assert actual["provenance"]["source_total_rows"] == 4177
    assert actual["feature_names"] == json.loads(RESULTS.read_text())["data"]["features"]
    assert [len(w["rows"]) for w in actual["windows"]] == [74, 48, 84, 118, 84, 118, 134]
    for attack, window in zip(actual["attack_intervals"], actual["windows"]):
        assert len(window["rows"]) == attack["duration_hours"] + 24
        assert window["attack_id"] == attack["id"]
        assert window["rows"][0]["timestamp"] == window["window_start"]
        assert window["rows"][-1]["timestamp"] == window["window_end"]
        assert all(len(row["values"]) == 43 for row in window["rows"])


def test_regeneration_contract_is_deterministic_for_valid_frames():
    frame, features = fixture_frame()
    first = build_export(frame, features, bd.load_attacks(), SOURCE.sha256, len(frame))
    second = build_export(frame.copy(), features, bd.load_attacks(), SOURCE.sha256, len(frame))
    assert first == second
    assert first["provenance"]["source_sha256"] == SOURCE.sha256
    assert len(first["windows"]) == 7
    assert sum(len(w["rows"]) for w in first["windows"]) == 660


def test_schema_prevents_missing_measured_hours_and_features():
    frame, features = fixture_frame()
    validate_hourly_frame(frame, features, 4177)
    with pytest.raises(bd.SchemaError):
        validate_hourly_frame(frame, features[:-1], 4177)
    with pytest.raises(bd.SchemaError):
        validate_hourly_frame(frame, list(reversed(features)), 4177)
    with pytest.raises(bd.SchemaError):
        validate_hourly_frame(frame.iloc[:-1], features, 4177)
    with pytest.raises(bd.SchemaError):
        validate_hourly_frame(frame.drop(frame.index[50]), features, 4176)
    with pytest.raises(bd.SchemaError):
        validate_hourly_frame(frame.iloc[::-1], features, 4177)
    bad = frame.copy()
    bad.iloc[3, 1] = np.inf
    with pytest.raises(bd.SchemaError):
        validate_hourly_frame(bad, features, 4177)


def test_export_refuses_modified_attack_intervals():
    frame, features = fixture_frame()
    attacks = bd.load_attacks()
    with pytest.raises(bd.SchemaError):
        build_export(frame, features, attacks[:-1], SOURCE.sha256, 4177)
