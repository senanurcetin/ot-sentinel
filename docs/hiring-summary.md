# Summary for reviewers

**OT-Sentinel** is an operator-facing anomaly dashboard for industrial telemetry: a statistical
detector decides, an LLM explains, and a deterministic fallback keeps the explanation useful when the
LLM is unavailable. It runs on synthetic telemetry; the real-data evaluation is **not yet run** (see
[case study](case-study.md)). This page lists what is verifiable in the repository without taking
my word for it.

## What it demonstrates

| Skill | Where to look |
|---|---|
| Full-stack TypeScript (Next.js App Router, React, server actions, zod) | `src/app/`, `src/components/`, `src/ai/flows/` |
| Applying an LLM with guard rails (verdict owned by the detector, input validation, timeout, rate limit, labelled fallback) | `src/ai/flows/threat-mitigation-alert.ts`, `src/lib/fallback-mitigation.ts` |
| Keeping Python and TypeScript consistent | `analysis/export_model.py` generates the scorer constants and the model card table; a test fails on drift |
| Evaluation design for imbalanced, time-ordered security data | `analysis/` (same false-alarm budget for every detector, labels never touch thresholds, event-level metrics) |
| Testing depth | Jest (unit, component, API routes) with coverage thresholds in `jest.config.ts`; Playwright E2E; pytest |
| Finding and fixing real defects | [case study, findings](case-study.md#findings-so-far-engineering-not-detection-performance) |
| Security hygiene for a web app | headers/CSP, rate limiting, validation, CSV-injection guard, CodeQL, `npm audit`, `pip-audit`; [threat model](threat-model.md) with verified ATT&CK for ICS identifiers |
| Delivery | Dockerfile, GitHub Actions (CI, E2E, security), Dependabot, changelog |

## Honest boundaries

- Telemetry is synthetic and the baseline comes from the demo's own simulator.
- No detection metrics are published; the BATADAL study is built and tested but not yet run.
- The detector is per-sample and static; the [model card](../MODEL_CARD.md) lists what it cannot see.
- There is no authentication, and no real protocol adapter (only an interface and rules for one).

## Run it in two minutes

```bash
npm install && cp .env.example .env     # GEMINI_API_KEY optional: without it the rule-based fallback is shown
npm run dev                             # http://localhost:9002 , flip "Simulate Attack"
```

Related: [Vision2DCS](https://github.com/senanurcetin/Vision2DCS) applies rule-based engineering
checks (ISA-5.1 tag naming, safety-function keywords, loop integrity) to P&ID extractions; it is a
different tool from the telemetry detector here.
