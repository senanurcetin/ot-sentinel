# analysis - OT anomaly-detection case study

Reproducible comparison of attack detectors on the public **BATADAL** water-distribution SCADA benchmark
(<https://www.batadal.net/data.html>), plus the code that exports the live scorer's constants.

## Status

| Part | State |
|---|---|
| Pipeline, metrics, detectors, tests | done |
| Run on the real BATADAL files | **done**; results in `src/data/batadal-case-study/results.json` |
| Tables in the README and the case study | generated from that file by `results_report.py`; a test fails if they are stale |
| Wiring the result into the live dashboard | not done (the dashboard uses a 3-signal demo scorer) |

The results and how to read them (they are modest) are in [`docs/case-study.md`](../docs/case-study.md).
No number is repeated in this file on purpose.

## Run it

```bash
cd analysis
pip install -r requirements-dev.txt
pytest && ruff check .                          # no data needed: tests use synthetic BATADAL-shaped files

# the real run needs the three BATADAL files in analysis/data/batadal/ (git-ignored):
#   BATADAL_dataset03.csv  BATADAL_dataset04.csv  BATADAL_test_dataset.zip
python run_batadal_case_study.py                # writes src/data/batadal-case-study/results.json
python results_report.py                        # regenerates the tables in README.md and docs/case-study.md
```

`batadal_data.py` pins the SHA-256 of the files the study was run on and refuses others. There is no
automatic download: the dataset host was not reachable from the authoring environment, so a downloader could
not be verified and was removed. Get the three files from <https://www.batadal.net/data.html> by hand.
`--synthetic` runs the pipeline on generated data as a smoke test: its output is labelled `NOT BATADAL`, goes to
`analysis/artifacts/synthetic-smoke/` and must never be quoted.

## Protocol (v2)

1. **Ground truth = the published attack intervals** (`batadal_attacks.json`). `ATT_FLAG` in the 2016 file is 1 for
   part of each attack and -999 ("unknown") elsewhere, with no 0 labels, so it cannot define "normal"; it is only
   used to check that every flagged hour lies inside an interval.
2. Unsupervised detectors learn from the first 80 % of attack-free `dataset03`. Its last 20 % only sets thresholds:
   the lowest threshold with at most one false-alarm segment per attack-free day, **the same budget for every detector**.
3. Alarm = score strictly above the threshold.
4. Evaluation, reported separately: the test file (attacks 8-14, headline) and `dataset04` (attacks 1-7, secondary).
   The supervised reference trains on `dataset04` and is evaluated on the test file only.
5. Signals that are constant in the reference are kept; any departure is treated as maximally anomalous.
6. Reported: attacks caught, **attacks expected from false alarms alone**, hours to detect, the share of attack-free
   hours in alarm, hour-level precision / recall, PR-AUC, a per-attack table and a drift diagnostic.

An amendment (items 3 and the two extra columns of 6) was made after a first run showed an always-on alarm
looking perfect; the history is in the case study.

## Detectors

| Name | Idea |
|---|---|
| `static_limits` | alarm outside the min-max seen in the reference (what a naive operator rule does) |
| `zscore_max` | largest per-signal \|z\|; same family as the live scorer in `src/lib/anomaly-scorer.ts` |
| `isolation_forest` | scikit-learn Isolation Forest on standardised signals |
| `hist_gradient_boosting` | supervised reference trained on the labelled 2016 attacks (optimistic) |

## Files

`batadal_data.py` loading, checksums, ground truth · `batadal_attacks.json` published intervals ·
`detectors.py` · `metrics.py` · `run_batadal_case_study.py` · `results_report.py` ·
`export_model.py` (live scorer constants and the model card table) · `synthetic.py` (test data only) ·
`tests/` · `train_anomaly_model.py` (original prototype, kept for history).
