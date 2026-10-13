---
description: Read-only source-backed acceptance for Telemetry Bugfix agent
---

# Telemetry Bugfix — custom agent acceptance

Read-only source acceptance. Invocation must be explicit: GitHub Copilot CLI `--agent=telemetry-bugfix` or a supported IDE agent selector. The external test harness, not the model response, must record the requested agent ID and CLI exit code. Do not mark NOT RUN just because no IDE selector was used. If the actual loaded profile is not independently shown by runtime evidence, mark profile identity UNVERIFIED separately from source-review results.

Read these checked-in files (if missing, record that fact):
- `AGENTS.md`
- `src/lib/anomaly-scorer.ts`
- `src/lib/anomaly-scorer.test.ts`
- `src/lib/telemetry-source.ts`
- `src/lib/telemetry-source.test.ts`
- `src/lib/limited-request-body.ts`
- `src/lib/rate-limit.ts`

Using ONLY files you actually inspect, answer:
1. Inspect how missing, nonfinite and extreme sensor readings are handled; indicate whether invalid inputs could silently become nominal or throw.
2. Choose one specific synthetic counterexample for score calibration, telemetry fallback, timeout, or request-body bounds, citing the actual function/test to extend.
3. Describe the minimum failing-test-first repair path that preserves valid-input responses; do not modify files in this acceptance probe.
4. Differentiate a testable software anomaly-score defect from deployment/OT-device safety, and identify unverified runtime scenarios.

For each numbered check, give PASS, FAIL, or UNVERIFIED and cite concrete path names plus the relevant function, condition or test. A passing source review is NOT proof that code was executed. Label all unrun tests, live-device claims, runtime deployments and CI UNVERIFIED. Do not edit files, execute shell commands, run tests, contact external APIs, install dependencies, touch credentials, or trigger CI/GitHub Actions/CircleCI/Vercel. No production fix or PR in this read-only probe; no device or external service calls.
