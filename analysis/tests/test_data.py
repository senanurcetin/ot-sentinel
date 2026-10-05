import pandas as pd
import pytest

import batadal_data as bd
from synthetic import make_synthetic, write_csv


def test_roundtrip_parses_time_labels_and_unlabelled(tmp_path):
    frames = make_synthetic(n_normal=100, n_attack=100)
    path = tmp_path / "attack.csv"
    write_csv(frames["attack"], path, unlabelled_prefix=10)
    loaded = bd.load_dataset(path)
    assert isinstance(loaded.index, pd.DatetimeIndex) and loaded.index.is_monotonic_increasing
    assert loaded["label"].isna().sum() == 10
    assert set(loaded["label"].dropna().unique()) <= {0, 1}
    assert loaded.index[0] == frames["attack"].index[0]


def test_feature_columns_drop_constants_and_label():
    frames = make_synthetic(n_normal=200, n_attack=100)
    cols = bd.feature_columns(frames["attack"])
    assert "CONST" not in cols and "label" not in cols and len(cols) == 8


def test_missing_time_column_raises(tmp_path):
    path = tmp_path / "bad.csv"
    pd.DataFrame({"a": [1, 2]}).to_csv(path, index=False)
    with pytest.raises(bd.SchemaError):
        bd.load_dataset(path)


def test_non_numeric_sensor_raises(tmp_path):
    path = tmp_path / "bad.csv"
    pd.DataFrame({"DATETIME": ["06/01/14 00"], "S": ["x"]}).to_csv(path, index=False)
    with pytest.raises(bd.SchemaError):
        bd.load_dataset(path)


def test_pinned_checksum_mismatch_raises(tmp_path):
    path = tmp_path / "f.csv"
    path.write_text("x")
    with pytest.raises(ValueError):
        bd.verify(path, bd.DatasetFile("k", "f.csv", "r", sha256="0" * 64))
    assert bd.verify(path, bd.DatasetFile("k", "f.csv", "r")) == bd.sha256_of(path)
