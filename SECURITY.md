# Security Policy

OT-Sentinel is a **demonstration** dashboard for OT/ICS anomaly monitoring. It is not a production
security product and must not be connected to a live control network.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private
[security advisory form](https://github.com/senanurcetin/ot-sentinel/security/advisories/new) for this
repository. Include a description, reproduction steps, and the impact you expect.

You can expect an acknowledgement within a few days. This is a single-maintainer portfolio project, so
there is no contractual fix timeline.

## Scope and known limits

- Telemetry is synthetic (and, once the BATADAL replay lands, replayed public data). No real PLC, Modbus
  or OPC-UA traffic is ingested.
- There is no authentication or multi-tenancy. Operator verdicts are the only stored data (SQLite when
  `FEEDBACK_DB_PATH` is set); they are capped and the summary endpoint returns aggregates only.
- `GEMINI_API_KEY` is read server-side only. Never commit `.env`; `.env.example` is the template.
- The AI layer explains a detection that the scorer has already made. It is not a detection control.

## Built-in protections

Security headers and a Content-Security-Policy on every route, per-client rate limits on the API
and on the AI server action, input validation (zod) with a body-size cap, a 20 s model timeout with
deterministic rule-based fallback, and CSV formula-injection protection. What they do and do not
cover is in [docs/threat-model.md](docs/threat-model.md).

## Automated checks

- `npm audit --omit=dev --audit-level=critical` and `pip-audit` on every PR and weekly
- Secret scanning (gitleaks) on every PR and weekly
- CodeQL (JavaScript/TypeScript) on every PR and weekly
- Dependabot for npm, pip (`analysis/`) and GitHub Actions

Remaining high-severity advisories in transitive dependencies are listed in
[DEPENDENCIES.md](DEPENDENCIES.md#known-advisories).
