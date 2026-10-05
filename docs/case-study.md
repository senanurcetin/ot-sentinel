# Case study: explainable anomaly triage for OT telemetry

> **Status: the measured comparison on real data has not been run.** Everything below states what
> exists, what was found while building it, and exactly what is still missing. No detection metric
> is reported anywhere in this repository because none has been measured on real attack data.

## Problem

An OT operator who gets an anomaly alert has to answer three questions fast: *is it real, which
signal is driving it, and what do I check first?* A raw score answers none of them, and an LLM that
is allowed to decide for itself whether something is an attack can invent a threat that is not there.

## Approach

1. **A deliberately simple detector decides.** Each reading is scored against an attack-free
   baseline (per-sensor z-score, weighted composite, mapped to 0-100). See the [model card](../MODEL_CARD.md).
2. **The LLM only explains.** It receives the detector's verdict and the per-sensor contributions and is
   told not to dispute or re-score it ([`src/ai/flows/threat-mitigation-alert.ts`](../src/ai/flows/threat-mitigation-alert.ts)).
3. **The explanation can fail safely.** On error, timeout or rate limit the operator gets
   deterministic, rule-based triage built from the detector's own output, labelled as such
   ([`src/lib/fallback-mitigation.ts`](../src/lib/fallback-mitigation.ts)).
4. **The operator closes the loop.** Each alert can be marked "confirmed threat" or "false alarm".
   Verdicts are stored in memory only and nothing reads them back yet.

![Alert with rule-based guidance](assets/alert-rule-based.png)

## What was built and checked

| Area | Evidence in the repo |
|---|---|
| Detector, explanation, fallback, UI | `src/lib/anomaly-scorer.ts`, `src/ai/flows/`, `src/components/` |
| Constants generated once, not typed twice | `analysis/export_model.py`; `pytest` fails if the artifact or the model card table is stale |
| Tests | Jest unit/component/route tests with coverage thresholds, Playwright end-to-end, pytest for the analysis code |
| Security | headers + CSP, rate limits, input validation, CodeQL, `npm audit`, `pip-audit`; see the [threat model](threat-model.md) |
| Architecture | [architecture.md](architecture.md) |

## Findings so far (engineering, not detection performance)

These came from testing the system end to end; both were real defects and both are fixed and covered by tests.

1. **The demo's "normal" data raised false CRITICAL alarms.** The detector's baseline was fitted on
   Gaussian draws, but the generator sampled the normal ranges uniformly and rounded vibration to two
   decimals. In a 200,000-draw simulation about **0.37 %** of normal samples crossed the CRITICAL line,
   roughly one false alarm every 4-5 minutes at the dashboard's 1 Hz polling. Drawing the same way the
   baseline was fitted brought it to about 0.002 %. A seeded test now fails if the rate regresses
   ([`src/lib/telemetry-source.test.ts`](../src/lib/telemetry-source.test.ts)). Lesson: a detector can
   look fine and still be mis-specified against the data it is served.
2. **The alert dialog re-asked the LLM every second.** Fresh telemetry handed the dialog a new object
   each tick, so with a slow model one alert cost several model calls. It now asks once per alert and
   discards answers that arrive after the dialog closed.

## Evaluation: what is missing and how it will be done

The comparison runs on the public [BATADAL](https://www.batadal.net/data.html) water-distribution
attack benchmark and is implemented in [`analysis/`](../analysis/README.md): a static-limit rule, the
current z-score scorer, an Isolation Forest, and a supervised reference, each set to the **same
false-alarm budget** on attack-free data, then scored on event-level recall, time-to-detect, false
alarms per day and PR-AUC. The code and its tests exist; **it has not been run on BATADAL** because
the authoring environment could not reach the dataset host. Until it is, the honest summary is:

- no claim that the z-score scorer detects real attacks,
- no claim about how it compares with the other detectors,
- no number to put in a README.

Documentation tests (`analysis/tests/test_docs.py`) enforce this: while no results file exists,
the docs must say the evaluation has not been run and must not contain metric values. Once
`src/data/batadal-case-study/results.json` exists, that test fails until the documents are updated from it.

## Limitations

- The telemetry is synthetic; the baseline comes from the demo's own simulated envelope.
- One sample at a time against a static baseline: slow drift, missing readings and stuck values are not caught.
- BATADAL is a simulation with few attack events, so even a finished study would carry wide uncertainty and
  would not justify claims about real plants.
- No authentication; the demo must not face an untrusted network.

## Reproduce

```bash
npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build
npx playwright install chromium && npm run test:e2e
cd analysis && pip install -r requirements-dev.txt && ruff check . && pytest
```
