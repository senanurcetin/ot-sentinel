# Evaluation protocol v3 (fixed before running)

This document is committed **before** any v3 detector is run on the real BATADAL files. The pipeline records the
protocol version in `results.json`, and the git history shows this file predates the results commit.

**Disclosure.** v3 is not a pre-registration in the strict sense: the v2 results (README, `docs/case-study.md`)
were already known when it was written. To keep that knowledge from steering the outcome, every new parameter
below is a textbook default chosen without looking at any v3 output, nothing is selected on labelled data, and
every result is reported whether it helps or not.

## What does not change (inherited from v2)

Data files and SHA-256 pins, ground truth (published attack intervals), the chronological 80/20 split of the
attack-free `dataset03` (fit / threshold calibration), the false-alarm budget (1 alarm segment per attack-free day,
calibrated on the 20 % slice only), the strict `score > threshold` alarm rule, the two evaluation sets (test file =
headline, `dataset04` = secondary), all v2 metrics, and the four v2 detectors with their parameters.

## Question

The v2 detectors score every hour on its own. Does adding **time** (smoothing, accumulation, or comparison with the
recent past) improve hour-level detection on the test file at the same false-alarm budget, and do the detectors'
explanations point at the attacked equipment?

## New detectors (parameters fixed here, no tuning)

All three are causal: the score at hour *t* uses hours ≤ *t* only. Each `score()` call receives one contiguous hourly
series (the calibration slice, the test file, or `dataset04`) and starts from a fresh state, so warm-up is handled
the same way during calibration and evaluation. Per-feature standardisation reuses the v2 z-score fit (mean and
standard deviation of the attack-free fit slice, with the same constant-feature floor).

| Name | Definition | Fixed parameter and source |
|---|---|---|
| `ewma_z` | Per feature, EWMA of the signed z-score, `e_t = λ z_t + (1-λ) e_{t-1}`, `e_0 = 0`; score = max over features of `|e_t|` | λ = 0.2, the usual EWMA control-chart choice (range 0.05-0.25 in Montgomery, *Introduction to Statistical Quality Control*) |
| `cusum` | Per feature, two-sided tabular CUSUM on the z-score, `S⁺_t = max(0, S⁺_{t-1} + z_t - k)`, `S⁻_t = max(0, S⁻_{t-1} - z_t - k)`, starting at 0, never reset; score = max over features of `max(S⁺, S⁻)` | k = 0.5 (detects a shift of one standard deviation, the textbook default). The decision interval *h* is not a parameter here: the calibrated threshold plays that role |
| `rolling_residual` | Per feature, `|x_t - mean(x_{t-24..t-1})| / σ_ref` (σ_ref from the v2 fit, floored); for *t* < 24 the available history is used, and *t* = 0 scores 0; score = max over features | window = 24 h, one daily demand cycle of a water network |

No persistence (k-of-n) wrapper and no other variant is added. Each extra detector is one more comparison on 7
attacks.

## Uncertainty

- **Hour-level metrics** (precision, attack hours caught, PR-AUC): a 95 % percentile interval from a day-block
  bootstrap of the evaluation set (calendar days resampled with replacement, 1000 resamples, seed 42). Thresholds
  stay fixed; they are not re-calibrated per resample.
- **Event-level metrics** get no interval. With 7 events, "n of 7" is reported as is.
- **Paired comparison with `zscore_max`** on the test file: the same bootstrap resamples give an interval for the
  PR-AUC difference (detector minus `zscore_max`).

## Explanation accuracy

Each attack's **affected signals** are derived mechanically from the official description text in
`analysis/batadal_attacks.json` (not from the concealment text, because concealed signals are replayed to look
normal):

- a tank `Tn` or `L_Tn` → `L_Tn`
- a pump `PUn` → `F_PUn`, `S_PUn`
- valve `V2` → `F_V2`, `S_V2`
- "Like attack N" / "Similar to attack N" → the signals of attack N

The rule and the resulting sets are encoded in code with a test listing all 14 sets.

**Metric.** Among attack hours in which a detector alarms, the share of hours whose **top 3** contributing features
(largest per-feature score at that hour) include at least one affected signal. It is reported per evaluation set and
per attack, next to the chance level for 3 random features out of 43:
`1 - C(43-k, 3) / C(43, 3)` for *k* affected signals.

This applies to detectors with per-feature scores (`static_limits`, `zscore_max`, `ewma_z`, `cusum`,
`rolling_residual`). Isolation Forest and gradient boosting have no comparable per-feature score and are marked
"not applicable".

## Decision rule (stated now, applied once)

A v3 detector counts as **better than `zscore_max`** only if, on the **test** file, the 95 % interval of its paired
PR-AUC difference lies entirely above 0. Otherwise the summary says "no detectable improvement", whatever the point
estimates show. Only a detector that passes this rule is considered for the live demo's scorer or a replay mode
(development plan C4).

## Reporting

All v2 and v3 detectors appear in the same tables, generated from `results.json` by `analysis/results_report.py`,
with `protocol.version = 3`. If a v3 detector is worse, that is the result. Any change to this document after the
first v3 run is listed under "Amendments" below, with the reason, as v2 did.

## Amendments

None yet.
