# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- ESLint flat config and a working `npm run lint`, enforced in CI
- Dockerfile (Next.js standalone, non-root) and a CI job that builds it
- Security workflow (npm audit gate on critical, CodeQL), Dependabot, PR template
- `SECURITY.md`, `DEPENDENCIES.md`, `CONTRIBUTING.md`

- `analysis/` pipeline for a BATADAL attack-detection case study: loader with schema validation,
  four detectors (static limits, z-score, Isolation Forest, gradient boosting), event-level
  metrics, a same-false-alarm-budget threshold protocol, and 27 pytest tests. **Not yet run on
  the real dataset** (no network access to batadal.net in the authoring environment).
- Python CI job (ruff + pytest)

- `analysis/export_model.py` generates `src/data/model/scorer-params.json`; the TypeScript scorer
  imports it instead of hand-copied constants, and a pytest fails if the artifact goes stale
- "Why this score?" panel: per-sensor z-score, share of the score and status
- `POST /api/feedback` (zod-validated, in-memory) and "false alarm" / "confirm threat" buttons
- Jest tests for the scorer, `/api/metrics`, `/api/feedback` and the new panel

- Dashboard, alert-dialog, forensic-report and Genkit-flow tests (63 Jest tests in total), Jest
  coverage thresholds, and Playwright E2E tests (`npm run test:e2e`, CI workflow `e2e-tests.yml`)
- `src/lib/forensic-csv.ts`: CSV export extracted and protected against spreadsheet formula injection

### Fixed
- The alert dialog re-requested the Gemini explanation every second while the first request was
  pending (telemetry updates handed it a new object each tick); it now asks once per alert and
  drops stale responses

### Changed
- Tests are type-checked by `npm run typecheck`; the global lucide-react mock was replaced by the
  real icons (CommonJS build)
- The "AI Confidence" card (which was `100 - anomaly_score*100`, not a confidence) is now the
  detector's **Risk Score**
- The Gemini prompt receives the detector's risk score and per-sensor contributions and is told
  to explain the detection, not re-decide it
- Scorer constants now come from the exported model statistics (e.g. temp mean 49.93, std 3.33)
  instead of rounded hand-typed values
- Package renamed from `nextn` to `ot-sentinel`
- Genkit default model moved from `gemini-1.5-flash-latest` to `gemini-2.5-flash`
- Next.js 15.5.9 → 15.5.27 (clears the critical advisory)
- Deployment is now "any container host or Vercel"; the unused Firebase App Hosting config was removed

### Removed
- Unused `firebase` and `patch-package` dependencies
