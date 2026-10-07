# Summary for reviewers

**OT-Sentinel** is an operator-facing anomaly dashboard for industrial telemetry: a statistical
detector decides, an LLM explains, and a deterministic fallback keeps the explanation useful when the
LLM is unavailable. The live demo runs on synthetic telemetry; the detection method is evaluated offline on the public
BATADAL benchmark with a modest result (see the [case study](case-study.md)). This page lists what is verifiable in the repository without taking
my word for it.

## What it demonstrates

| Skill | Where to look |
|---|---|
| Full-stack TypeScript (Next.js App Router, React, server actions, zod) | `src/app/`, `src/components/`, `src/ai/flows/` |
| Applying an LLM with guard rails (verdict owned by the detector, input validation, timeout, rate limit, labelled fallback) | `src/ai/flows/threat-mitigation-alert.ts`, `src/lib/fallback-mitigation.ts` |
| Keeping Python and TypeScript consistent | `analysis/export_model.py` generates the scorer constants and the model card table; a test fails on drift |
| Evaluation design for imbalanced, time-ordered security data | `analysis/`: same false-alarm budget for every detector, thresholds from attack-free data only, a chance baseline for event recall, published attack intervals as ground truth after finding the label column unusable |
| Testing depth | Jest (unit, component, API routes) with coverage thresholds in `jest.config.ts`; Playwright E2E; pytest |
| Finding and fixing real defects | [case study, findings](case-study.md#findings-from-building-the-system-engineering-not-detection-performance) |
| Security hygiene for a web app | headers/CSP, rate limiting, validation, CSV-injection guard, CodeQL, `npm audit`, `pip-audit`; [threat model](threat-model.md) with verified ATT&CK for ICS identifiers |
| Delivery | Dockerfile, GitHub Actions (CI, E2E, security), Dependabot, changelog |

## Honest boundaries

- Telemetry is synthetic and the baseline comes from the demo's own simulator.
- The BATADAL result is modest and rests on 7 attacks per file; it evaluates the method on 43 signals, not the live dashboard's 3-signal scorer.
- One of my own metrics was flawed (an always-on alarm looked perfect) until the first run exposed it; the amendment is documented, not hidden.
- The detector is per-sample and static; the [model card](../MODEL_CARD.md) lists what it cannot see.
- There is no authentication, and no real protocol adapter (only an interface and rules for one).

## Run it in two minutes

```bash
npm install && cp .env.example .env     # GEMINI_API_KEY optional: without it the rule-based fallback is shown
npm run dev                             # http://localhost:9002 , flip "Simulate Attack"
```

Results, with the tables generated from the run: [case study](case-study.md#evaluation-on-batadal).

Related: [Vision2DCS](https://github.com/senanurcetin/Vision2DCS) applies rule-based engineering
checks (ISA-5.1 tag naming, safety-function keywords, loop integrity) to P&ID extractions; it is a
different tool from the telemetry detector here.
