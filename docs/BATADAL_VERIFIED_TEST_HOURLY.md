# Publisher-verified 2017 BATADAL unseen test hourly history

Route: `/batadal-test-history`. Original data credit: BATADAL,
Taormina, Galelli, Tippenhauer, Salomons, Ostfeld et al. (2018),
*The Battle of the Attack Detection Algorithms: Disclosing Cyber Attacks
on Water Distribution Networks*. Publisher source:
https://github.com/scy-phy/www.batadal.net/blob/master/data/BATADAL_test_dataset.zip

License: publisher's [CC BY 4.0](https://github.com/scy-phy/www.batadal.net/blob/master/LICENSE.md);
this derived window excerpt retains attribution and describes the adaptation.

## Original source and checksum

The **original unlabelled 2017 test ZIP** was fetched from the
publisher-controlled `scy-phy/www.batadal.net` repository in a temporary,
read-only GitHub Actions verification job. The full archive's SHA-256 matched
the digest already pinned in `analysis/batadal_data.py`:

`27e4a15eca583fca8bf133360866189f50af982899ad18b66dff70fb78d1a6fa`

The verifier rejected incorrect hash, unexpected ZIP members, wrong column
order, nonfinite readings and non-monotonic/missing hourly timestamps. It
confirmed 2,089 original hourly rows and all 43 original BATADAL measurement
columns, no label column, and published attack intervals 8–14. The successful
temporary workflow was removed before release.

The checked-in `src/data/batadal-case-study/verified-hourly-test.json`
retains **575 genuine rows** (window sizes 94, 89, 55, 55, 124, 104 and
54), each with all 43 original sensor readings. Each window contains the
published attack interval plus 12 actual pre- and 12 actual post-attack hours.
No interpolation, smoothing, imputation or model-derived readings were
added. The derived excerpt is not the entire underlying ZIP.

## Reproduction

Use the existing official-source export script from the repository root:

```bash
python3 analysis/export_official_test_hourly.py --check
```

This downloads only the publisher's unmodified 2017 ZIP, checks the
independently pinned SHA-256 and all row/source constraints, builds the
derived artifact, and checks it against the committed JSON. It aborts on
any difference. To explicitly rebuild the artifact from verified bytes,
a maintainer may run `--write` in a reviewed maintenance branch.

The independent attack intervals are from
`analysis/batadal_attacks.json`, **not** labels in the unlabelled ZIP.
The source DATETIME format does not specify a timezone. Display timestamps
are source-local calendar labels, not asserted UTC.

## Scientific and security limits

- This is 2017 holdout **source telemetry**, not previously unseen
  model training or predictions. Switching sensors only changes which
  original column is plotted, not model inference.
- Shaded attack periods denote published ground-truth attack intervals.
  They are not sensor anomalies automatically detected by this app.
- The 2016 dataset04 history stays separate under `/batadal-history`;
  its attacks 1–7 are secondary/training-period observations.
- BATADAL C-Town is a **water-network simulation**, not a live
  connected PLC/SCADA plant or proof of generalization to a real facility.
- No endpoints are connected, no sensor values uploaded, and no commands
  sent to industrial systems. Source hashes verify file identity, not the
  authenticity of any particular physical plant.
- Statistical detector performance and bootstrap intervals remain in the
  separate offline `/case-study` analysis. This feature does not re-fit
  thresholds on the holdout data.

## Acceptance tests

- Jest validates the 2017 source digest, expected feature order, 575
  derived samples, all seven intervals, source chronology and failure
  on forged files; 2016 history remains untouched.
- React and Chromium validate 2017 selection, a real 43-column signal
  plot, source-local timestamps, holdout disclaimers and 2016 navigation.
- Production merge requires green exact-head CircleCI web, Python,
  Chromium and GitHub Docker/CodeQL/npm/pip audits/Gitleaks.
