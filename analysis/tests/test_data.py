import json

import pandas as pd
import pytest

import batadal_data as bd
from synthetic import make_synthetic, write_files


@pytest.fixture
def files(tmp_path):
    frames, attacks = make_synthetic()
    write_files(frames, tmp_path)
    return tmp_path, frames, attacks


def test_loader_reads_the_real_layout_including_the_zipped_test_file(files):
    directory, frames, _ = files
    normal = bd.load_dataset(directory / "BATADAL_dataset03.csv")
    train = bd.load_dataset(directory / "BATADAL_dataset04.csv")  # padded header and cells
    test = bd.load_dataset(directory / "BATADAL_test_dataset.zip")
    for frame in (normal, train, test):
        assert isinstance(frame.index, pd.DatetimeIndex) and frame.index.is_monotonic_increasing
        assert all(c == c.strip() for c in frame.columns)
    assert "flag" not in test.columns  # the real test file has no label column
    assert test.index[0] == frames["test"].index[0]


def test_unknown_label_is_na_not_normal(files):
    directory, frames, attacks = files
    train = bd.load_dataset(directory / "BATADAL_dataset04.csv")
    assert set(train["flag"].dropna().unique()) == {1}  # like the real file: no 0 labels
    assert train["flag"].isna().sum() > train["flag"].eq(1).sum()
    normal = bd.load_dataset(directory / "BATADAL_dataset03.csv")
    assert set(normal["flag"].unique()) == {0}


def test_constant_reference_features_are_kept(files):
    directory, _, _ = files
    normal = bd.load_dataset(directory / "BATADAL_dataset03.csv")
    features = bd.feature_columns(normal)
    assert "S_PU1" in features and "F_PU3" in features and "flag" not in features


def test_flags_must_lie_inside_the_published_intervals(files):
    directory, _, attacks = files
    train = bd.load_dataset(directory / "BATADAL_dataset04.csv")
    train_attacks = [a for a in attacks if a.dataset == "train"]
    report = bd.check_flags_inside_intervals(train, train_attacks)
    assert report["flagged_hours"] == report["flagged_inside_intervals"] > 0
    assert report["interval_hours_in_file"] == sum(a.duration_hours for a in train_attacks)
    # shifting the intervals away must be detected
    shifted = [
        bd.Attack(
            a.id,
            a.dataset,
            a.start + pd.Timedelta(days=30),
            a.end + pd.Timedelta(days=30),
            a.duration_hours,
            a.description,
            a.concealment,
            a.labeled_hours,
        )
        for a in train_attacks
    ]
    assert bd.check_flags_inside_intervals(train, shifted)["flagged_inside_intervals"] == 0


def test_attack_mask_and_ids_are_inclusive_at_both_ends(files):
    _, frames, attacks = files
    test = frames["test"]
    atk = [a for a in attacks if a.dataset == "test"]
    mask = bd.attack_mask(test.index, atk)
    ids = bd.attack_ids_at(test.index, atk)
    assert mask.sum() == sum(a.duration_hours for a in atk)
    first = atk[0]
    assert mask[test.index.get_loc(first.start)] and mask[test.index.get_loc(first.end)]
    assert (
        not mask[test.index.get_loc(first.start) - 1]
        and not mask[test.index.get_loc(first.end) + 1]
    )
    assert set(ids[mask]) == {a.id for a in atk} and set(ids[~mask]) == {0}


def test_missing_time_column_non_numeric_and_nan_raise(tmp_path):
    bad = tmp_path / "bad.csv"
    pd.DataFrame({"a": [1, 2]}).to_csv(bad, index=False)
    with pytest.raises(bd.SchemaError):
        bd.load_dataset(bad)
    pd.DataFrame({"DATETIME": ["06/01/14 00"], "S": ["x"]}).to_csv(bad, index=False)
    with pytest.raises(bd.SchemaError):
        bd.load_dataset(bad)
    pd.DataFrame({"DATETIME": ["06/01/14 00", "06/01/14 01"], "S": [1.0, None]}).to_csv(
        bad, index=False
    )
    with pytest.raises(bd.SchemaError):
        bd.load_dataset(bad)


def test_zip_must_contain_exactly_one_csv(tmp_path):
    import zipfile

    path = tmp_path / "x.zip"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("a.csv", "DATETIME,S\n06/01/14 00,1\n")
        z.writestr("b.csv", "DATETIME,S\n06/01/14 00,1\n")
    with pytest.raises(bd.SchemaError):
        bd.load_dataset(path)


def test_pinned_checksum_mismatch_raises(tmp_path):
    path = tmp_path / "f.csv"
    path.write_text("x")
    with pytest.raises(ValueError):
        bd.verify(path, bd.DatasetFile("k", "f.csv", "r", sha256="0" * 64))
    assert bd.verify(path, bd.DatasetFile("k", "f.csv", "r")) == bd.sha256_of(path)


# --- the published attack table ---------------------------------------------------------------


def test_published_attack_table_is_internally_consistent():
    attacks = bd.load_attacks()  # validate_attacks runs inside
    assert [a.id for a in attacks] == list(range(1, 15))
    assert sum(a.duration_hours for a in attacks if a.dataset == "train") == 492
    assert sum(a.duration_hours for a in attacks if a.dataset == "test") == 407
    assert sum(a.labeled_hours or 0 for a in attacks if a.dataset == "train") == 219
    assert all(a.concealment is not None for a in attacks)


def test_validate_attacks_rejects_wrong_duration_and_overlap():
    attacks = bd.load_attacks()
    a = attacks[0]
    wrong = bd.Attack(
        a.id, a.dataset, a.start, a.end, a.duration_hours + 1, "", "", a.labeled_hours
    )
    with pytest.raises(ValueError, match="spans"):
        bd.validate_attacks([wrong])
    overlap = bd.Attack(99, a.dataset, a.start, a.end, a.duration_hours, "", "", a.labeled_hours)
    with pytest.raises(ValueError, match="overlaps"):
        bd.validate_attacks([a, overlap])


def test_attack_file_keeps_its_provenance_note():
    raw = json.loads(bd.ATTACKS_FILE.read_text(encoding="utf-8"))
    assert "batadal.net" in raw["_source"] and "ATT_FLAG" in " ".join(raw["_notes"])
