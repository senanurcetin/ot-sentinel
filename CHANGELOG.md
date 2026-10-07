# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- **Evaluation protocol v3** ([`docs/protocol-v3.md`](docs/protocol-v3.md)), committed before its first run: three
  causal temporal detectors with fixed textbook parameters (EWMA of z-scores, two-sided CUSUM, 24 h rolling
  residual), day-block bootstrap 95 % intervals, a paired PR-AUC comparison with the z-score, explanation accuracy
  (do the top-3 signals of an alarm include equipment the attack description names?) and a decision rule stated
  in advance
- Result, reported as is: by that rule no temporal detector improves on the z-score on the test file (two are
  worse; the EWMA is better on the 2016 file only), and the z-score's explanations point at the attacked equipment
  roughly three times as often as chance, except under replay concealment
- `/case-study` page: interval column, v3 decision and explanation-accuracy sections; README, case study, model
  card and reviewer summary updated, with every new prose claim encoded as a test

## [0.3.0] - 2026-10-07

### Added
- `GET /api/health` liveness endpoint (no rate limit, no telemetry); the Docker `HEALTHCHECK` uses it instead of
  `/api/metrics`, which is rate-limited and generates a sample on every probe
- `E2E_BASE_URL` runs the Playwright suite against a deployed instance instead of a local server

### Removed
- Unused remote image hosts (placehold.co, Unsplash, picsum) from `next.config.ts` and the CSP `img-src`, and the
  empty `placeholder-images` module; the app loads no remote images
- 23 shadcn/ui components the app never rendered and the packages only they used (14 `@radix-ui/*` packages,
  `react-hook-form`, `@hookform/resolvers`, `react-day-picker`, `date-fns`, `embla-carousel-react`), plus the
  unused `@genkit-ai/next`; 39 fewer installed packages

### Changed
- Next.js 16 (Turbopack build) with `eslint-config-next` 16 as a native flat config; `@eslint/eslintrc` removed.
  Next 16's `react-hooks/refs` rule found the dashboard writing refs during render; they are now synced in an effect.
  `AGENTS.md` is the agent guidance file Next 16 generates and asks to be committed
- lucide-react 1.x (every imported icon still resolves), `@testing-library/jest-dom` 7, CodeQL action v4
- Node 24 (active LTS) in CI and the Docker image; Node 20 reached end of life on 2026-04-30
- Dependency updates from the first Dependabot run: React and React DOM 19.3 (together; Dependabot's PR bumped
  only `react` and failed), Radix UI group, Playwright 1.63, Jest 30 with jest-environment-jsdom 30 and
  `@types/jest` 30, dotenv 18 (`quiet` startup), `@types/node` 24, in-range npm updates, GitHub Actions
  (checkout, setup-node, setup-python, upload-artifact v7; gitleaks-action v3), and the analysis lower bounds
  (numpy 2.4.6, pandas 3.0.6, scikit-learn 1.9.1, pytest 9.1.1, ruff 0.16.10); BATADAL results unchanged
- Dependabot groups minor/patch updates and ignores four majors that need a migration (TypeScript 7, zod 4,
  Tailwind 4, Recharts 3); reasons in `DEPENDENCIES.md`

## [0.2.0] - 2026-10-06

### Added
- ESLint flat config and a working `npm run lint`, enforced in CI
- Dockerfile (Next.js standalone, non-root) and a CI job that builds it
- Security workflow (npm audit gate on critical, CodeQL), Dependabot, PR template
- `SECURITY.md`, `DEPENDENCIES.md`, `CONTRIBUTING.md`

- `analysis/` pipeline for a BATADAL attack-detection case study: loader with schema validation,
  four detectors (static limits, z-score, Isolation Forest, gradient boosting), event-level
  metrics and a same-false-alarm-budget threshold protocol.
- Python CI job (ruff + pytest)

- `analysis/export_model.py` generates `src/data/model/scorer-params.json`; the TypeScript scorer
  imports it instead of hand-copied constants, and a pytest fails if the artifact goes stale
- "Why this score?" panel: per-sensor z-score, share of the score and status
- `POST /api/feedback` (zod-validated, in-memory) and "false alarm" / "confirm threat" buttons
- Jest tests for the scorer, `/api/metrics`, `/api/feedback` and the new panel

- Dashboard, alert-dialog, forensic-report and Genkit-flow tests (63 Jest tests in total), Jest
  coverage thresholds, and Playwright E2E tests (`npm run test:e2e`, CI workflow `e2e-tests.yml`)
- `src/lib/forensic-csv.ts`: CSV export extracted and protected against spreadsheet formula injection

- Security headers and CSP (`src/lib/security-headers.ts`), per-client rate limiting for `/api/metrics`,
  `/api/feedback` and the AI server action, request validation (zod query, 4 KB body cap) and
  `Cache-Control: no-store` on API responses
- Deterministic rule-based mitigation guidance (`src/lib/fallback-mitigation.ts`) and a 20 s timeout
  for the Gemini call; the dialog labels fallback guidance as "AI explanation unavailable"
- `TelemetrySource` interface (`src/lib/telemetry-source.ts`) as the boundary for future replay and
  read-only protocol adapters
- `docs/threat-model.md` with threats, mitigations, residual risk and an ATT&CK for ICS mapping
  (identifiers verified against MITRE's data)
- `pip-audit` and gitleaks jobs in the security workflow

- Presentation layer: rewritten README (status table, screenshots, 35 s walkthrough video), `MODEL_CARD.md`
  (parameter table generated from `scorer-params.json`), `docs/architecture.md` (mermaid diagrams),
  `docs/case-study.md`, `docs/hiring-summary.md`; the original Firebase Studio spec moved to `docs/archive/`
- `analysis/tests/test_docs.py`: relative links must resolve; metric values may only appear in generated blocks

- **BATADAL evaluation run on the real data** (protocol v2): published attack intervals as ground truth
  (`batadal_attacks.json`), zip/padded-header loader, constant signals kept, per-attack and drift tables,
  `results_report.py` generating every number in the README and case study, and a test that checks the prose
  claims against `results.json`
- Metrics that expose degenerate detectors: false-alarm hour fraction and the number of attacks expected to be
  "caught" by false alarms alone

- `/case-study` page in the app: the same results as the README tables, read from `results.json` and validated
  with zod at build time (synthetic or malformed results fail the build), caveats first, real `h2` headings;
  linked from the dashboard header; unit tests, a test that its cells equal the README table, and E2E

### Fixed
- README and the app disagreed on exact rounding ties (0.1825 showed as 18.2 % in Python, 18.3 % in
  JavaScript); both now round the stored 4-decimal value half-up with integer arithmetic, with a test that
  compares the page's cells with the generated README table
- The first BATADAL run showed the static-limit detector alarming permanently and looking perfect (alarm rule
  `>=` plus a segment-based budget); alarms are now strictly above the threshold and the new columns make the
  failure visible; regression test added
- Normal-mode telemetry crossed the CRITICAL line about once every 4-5 minutes (0.37 % of samples in a
  200,000-draw simulation): the generator sampled the ranges uniformly and rounded vibration to two
  decimals, while the baseline had been fitted on Gaussian draws. It now draws the way the baseline was
  fitted (about 0.002 %), with seeded regression tests
- The alert dialog re-requested the Gemini explanation every second while the first request was
  pending (telemetry updates handed it a new object each tick); it now asks once per alert and
  drops stale responses

### Changed
- `GET /api/metrics` now returns 400 for an `attack` value other than `true`/`false` (previously
  anything but `true` meant normal operation)
- `generateThreatMitigationAlert` validates its input, never throws on model failure, and returns a
  `source` of `ai` or `fallback`
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
- The unverified `--download` path of the BATADAL pipeline (the dataset host was unreachable, so it could not be
  tested); files are placed by hand and checked against pinned SHA-256 values
