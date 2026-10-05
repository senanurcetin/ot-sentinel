# analysis — OT anomaly-detection case study

Reproducible comparison of attack detectors on the public **BATADAL** water-distribution SCADA
benchmark (<https://www.batadal.net/data.html>), plus the original prototype script.

## Status

| Part | State |
|---|---|
| Pipeline, metrics, detectors, tests | done, tested on synthetic BATADAL-shaped data |
| Run on the real BATADAL files | **not run yet** — the authoring environment could not reach batadal.net |
| Published results / README numbers | **none** — they will be added only from a real run |

`run_batadal_case_study.py --synthetic` exists to smoke-test the pipeline. Its output is labelled
`NOT BATADAL`, is written outside the app's data directory, and must never be quoted as a result.

## Run it

```bash
cd analysis
pip install -r requirements-dev.txt
pytest && ruff check .                       # no network or data needed

python run_batadal_case_study.py --download  # fetch the public CSVs into analysis/data/batadal/
python run_batadal_case_study.py --pin-checksums   # then paste the hashes into batadal_data.py
```

Or place `BATADAL_dataset03.csv`, `BATADAL_dataset04.csv` (and optionally
`BATADAL_test_dataset.csv`) in `analysis/data/batadal/` yourself and run without `--download`.
Output: `src/data/batadal-case-study/results.json`.

**First real run:** `batadal_data.py` records the file-format assumptions (timestamp column
`DATETIME`, label column `ATT_FLAG` with non-0/1 meaning unlabelled). They are unverified; the
loader fails loudly on a mismatch instead of guessing. Check them first.

## Protocol

1. Attack-free data: first 80 % fits the unsupervised detectors; last 20 % only sets thresholds.
2. Every detector gets the **same false-alarm budget** (default 1 alarm segment per attack-free
   day); the threshold is the lowest score cut-off meeting it on the held-out attack-free tail.
   No attack label can influence a threshold (enforced by a test).
3. The labelled file is split chronologically at an attack-free point (never inside an event).
   The first half trains the supervised reference; all detectors are scored on the second half.
4. Reported: events detected, time-to-detect, false alarms per day, point-wise PR-AUC.

## Detectors

| Name | Idea |
|---|---|
| `static_limits` | alarm outside the min/max seen in training (what a naive operator rule does) |
| `zscore_max` | largest per-sensor \|z\|; same family as the runtime scorer in `src/lib/anomaly-scorer.ts` |
| `isolation_forest` | scikit-learn Isolation Forest on standardised sensors |
| `hist_gradient_boosting` | supervised reference trained on labelled attacks (optimistic) |

## Files

`batadal_data.py` download/verify/load · `detectors.py` · `metrics.py` · `synthetic.py` (test data
only) · `run_batadal_case_study.py` · `tests/` · `train_anomaly_model.py` (original prototype,
kept for history; superseded by the pipeline above).
