# CI and security coverage contract

The repository uses GitHub `main` as its canonical code history and accepts a
release only after **exact-head** checks pass. GitHub Actions and CircleCI are
complementary, not interchangeable substitutes.

| Gate | GitHub automatic PR/main | CircleCI automatic PR/main |
| --- | --- | --- |
| ESLint, TypeScript, Jest coverage, Next.js production build | Yes | `web-quality` |
| Python Ruff, pytest | Yes | `analysis-quality` |
| Real Chromium Playwright browser suite | Yes | `browser-e2e` |
| Docker image build | Yes | Not yet |
| CodeQL JS/TS | Yes | No equivalent installed |
| npm production audit (critical gate) | Yes | `web-quality` |
| pip dependency audit | Yes | Not yet |
| Full-history Gitleaks scan | Yes | Not yet |
| Weekly scheduled security audit | Yes | Not yet |

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
without implementing complete security coverage elsewhere. This additive
browser job is the **safe first step**, not proof that GitHub minutes have been
reduced. Cost-saving changes must be evaluated separately against the matrix.

The Playwright job starts the production Next.js build in an isolated CircleCI
container, using a deliberately unusable Gemini placeholder credential to
exercise fallback behavior. No OT/PLC connections or production secrets are used.
