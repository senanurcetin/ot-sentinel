# Authentic BATADAL 2016 source-measured hourly history

Route: `/batadal-history`, linked from `/batadal-explorer` and `/case-study`.
Purpose: show *original* hourly 2016 C-Town simulation sensor readings in
attack windows, not pretend an online 3-sensor demo or a model's predictions
are actual plant events.

## Source identity and integrity

The authoritative public source is BATADAL's own published download page:
https://www.batadal.net/data.html

The original official site source repository is:
https://github.com/scy-phy/www.batadal.net/tree/master/data

Exact complete source bytes were read from publisher-controlled
`data/BATADAL_dataset04.csv` (1,225,392 bytes) and independently checked
against the digest already pinned in `analysis/batadal_data.py`:

`4746beab2cfcdb5e68c7fa197a7522aecb70189d61dcc3eb1f870d2ce387068b`

They **matched**. The official dataset03 normal-only CSV likewise matched
its pinned digest:
`8ca6cb851242254d2605b5a53ba3ba5009e2213a545d65396615f1ce0b426e1b`.

The complete original source CSVs and binary 2017 test ZIP are not committed to
the web app. The small derived 2016 artifact in
`src/data/batadal-case-study/verified-hourly-dataset04.json` contains exactly
660 original hour records, all 43 source sensor values per record, with 12
actual pre-attack and 12 actual post-attack hours around each of the seven
published attacks (IDs 1–7). Included window sizes: 74, 48, 84, 118, 84, 118,
134 records respectively. Numeric values were parsed but **not interpolated
or imputed**. All original data source rows were checked for one-hour cadence;
values are finite and ordered by the original 43-feature list.

## Reproduce the derived artifact

Download the original unmodified BATADAL_dataset04.csv from the official site
or its publisher's GitHub source repository and place it outside Git history.
From the repository root, in the existing Python analysis environment:

```bash
python3 analysis/export_verified_hourly.py --input analysis/data/batadal/BATADAL_dataset04.csv --check
```

This verifies the file's complete SHA-256, the original unsorted source
chronology, all feature names and counts, attack IDs, sampled windows and the
complete content of the committed derived artifact. It aborts on any mismatch.
`--write` is an explicit maintenance-only alternative to regenerate the
artifact using the pinned official source. Synthetic unit-test frames can
test exporter validation, but can **never pass source SHA-256 verification**.
Neither command fetches untrusted mirrors nor makes network calls.

## Analytical contract and limitations

- Attack labels and durations come from `analysis/batadal_attacks.json`,
  which contains BATADAL-published attack time intervals; the incomplete
  `ATT_FLAG` column is not used as normal/attack ground truth.
- All 43 original features are available for inspection in the selected
  window. Levels/pressures use metres, flow LPS, states 0/1 per BATADAL.
- The selected signal is plotted independently to avoid mixing incompatible
  units. The shaded area annotates the published attack interval, **not**
  a model-detected or falsely calibrated anomaly.
- The source `DATETIME` is `DD/MM/YY HH` without a defined time zone.
  Stored ISO-shaped timestamps are a formatting change only; they are
  **source-local, not asserted UTC**. No hidden timezone conversion.
- The 2016 dataset04 is a **secondary training-period** evaluation set,
  not unseen holdout evidence. There are **no** hourly 2017 test measurements
  in this artifact; that ZIP must be separately acquired and hash-verified
  before showing such curves.
- Published BATADAL C-Town data are from a simulation, not connected PLC,
  Modbus, OPC-UA or a live water plant.
- This UI performs no ML training, new scoring, telemetry uploads, writes to
  industrial endpoints or automatic remote network requests.
- This work does not represent identity certification, forensics attestation,
  model transfer to production, or an OT safety guarantee.

## Merge acceptance

- Source sha256 and frame/schema tests in Jest and Python; missing/duplicate
  hours, labels and columns fail closed.
- Chromium E2E charts real source-derived values for attacks 1 and 7,
  changes sensor category and verifies the 2017 test is not claimed.
- CircleCI `web-quality`, `analysis-quality`, `browser-e2e`; GitHub Docker,
  CodeQL, npm/pip audits and Gitleaks green on the **exact PR HEAD**.
- Full raw 2017-source verification remains tracked in
  [Issue #70](https://github.com/senanurcetin/ot-sentinel/issues/70).
