---
description: Read-only source-backed acceptance for OT Security QA agent
---

# OT Security QA — custom agent acceptance

Read-only source acceptance. Invocation must be explicit: GitHub Copilot CLI `--agent=ot-security-qa` or a supported IDE agent selector. The external test harness, not the model response, must record the requested agent ID and CLI exit code. Do not mark NOT RUN just because no IDE selector was used. If the actual loaded profile is not independently shown by runtime evidence, mark profile identity UNVERIFIED separately from source-review results.

Read these checked-in files (if missing, record that fact):
- `AGENTS.md`
- `src/lib/anomaly-scorer.ts`
- `src/lib/forensic-csv.ts`
- `src/lib/rate-limit.ts`
- `src/lib/telemetry-source.ts`
- `src/lib/anomaly-scorer.test.ts`
- `src/lib/forensic-csv.test.ts`
- `src/lib/rate-limit.edge.test.ts`

Using ONLY files you actually inspect, answer:
1. Trace finite-number sensor input checks, risk-score boundaries and per-sensor contributions. Separate a software threshold from a certified anomaly detector.
2. Show how the forensic CSV builder prevents spreadsheet-formula injection and quote/Unicode issues; identify which synthetic test covers it.
3. Explain in-memory rate-limit fixed-window/key isolation and why per-instance limiting cannot be a production security boundary.
4. Differentiate generated simulation telemetry from verified live OT telemetry; propose one offline negative case for an API or telemetry failure path.

For each numbered check, give PASS, FAIL, or UNVERIFIED and cite concrete path names plus the relevant function, condition or test. A passing source review is NOT proof that code was executed. Label all unrun tests, live-device claims, runtime deployments and CI UNVERIFIED. Do not edit files, execute shell commands, run tests, contact external APIs, install dependencies, touch credentials, or trigger CI/GitHub Actions/CircleCI/Vercel. No live OT network, device probes, training, scans or production security claims.
