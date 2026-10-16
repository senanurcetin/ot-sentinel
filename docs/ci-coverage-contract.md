# CI and security coverage contract

The repository uses GitHub `main` as its canonical code history and accepts a
release only after **exact-head** checks pass. GitHub Actions and CircleCI are
complementary, not interchangeable substitutes.

| Gate | GitHub automatic PR/main | CircleCI automatic PR/main |
| --- | --- | --- |
| ESLint, TypeScript, Jest coverage, Next.js production build | Manual (`workflow_dispatch`) | `web-quality` (automatic) |
| Python Ruff, pytest | Manual (`workflow_dispatch`) | `analysis-quality` (automatic) |
| Real Chromium Playwright browser suite | Manual (`workflow_dispatch`) | `browser-e2e` (automatic) |
| Docker image build | Yes (automatic PR/main) | Not yet |
| CodeQL JS/TS | Yes | No equivalent installed |
| npm production audit (critical gate) | Yes | `web-quality` |
| pip dependency audit | Yes | Not yet |
| Full-history Gitleaks scan | Yes | Not yet |
| Weekly scheduled security audit | Yes | Not yet |

**CI runner optimization:** GitHub's web/Python CI jobs now run only when
manually invoked; their automatic checks are supplied by CircleCI. The GitHub
Docker build still runs for every PR/main push (it no longer depends on
a web job that would be skipped). GitHub Playwright is manual-only because
CircleCI Chromium E2E was proven green on #60. This removes redundant GitHub
web/Python/browser **runner execution**, not the GitHub workflow trigger
itself or GitHub's mandatory security tasks. If CircleCI is unavailable,
do not merge with missing quality/browser verification; dispatch the matching
GitHub fallback jobs and examine results.

**Release rule:** Preserve the GitHub Security workflow's `pull_request`,
`push`, `schedule` (weekly) and manual triggers until equivalent checked,
documented replacements are proven. A green CircleCI browser job does **not**
prove CodeQL, secret scanning, Python dependency auditing or Docker health.

A small pytest regression guard in `analysis/tests/test_ci_coverage_contract.py`
checks that critical workflow strings are still present, but it does not parse
YAML or replace examining real CI status. Changes to provider, runtime,
permissions or branch protection still require independent review.

The old [PR #48](https://github.com/senanurcetin/ot-sentinel/pull/48)
proposed disabling nearly all GitHub Actions triggers to conserve minutes
without implementing complete security coverage elsewhere. The additive
browser job provided the proof of parity before duplicate GitHub CI/E2E
jobs were made manual-only. Scheduled CodeQL, security scans, and automatic
Docker builds were deliberately retained.

The Playwright job starts the production Next.js build in an isolated CircleCI
container, using a deliberately unusable Gemini placeholder credential to
exercise fallback behavior. No OT/PLC connections or production secrets are used.
