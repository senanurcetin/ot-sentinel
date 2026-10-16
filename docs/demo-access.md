# Demo access policy and release checks

OT-Sentinel is a **synthetic OT monitoring demonstration**. No current code
proves connection to a physical plant, valid device identity, per-user
authorization, a production incident or certified industrial safety.

## Two supported demonstration modes

**Open portfolio mode (default):** omit the `DEMO_BASIC_AUTH` environment
variable entirely. A published site is reachable without a password and anyone
can submit synthetic operator feedback; do not put private or actual plant
information on it.

**Shared-password demo mode:** set a unique random value of the form
`DEMO_BASIC_AUTH=user:at-least-16-character-secret` in a runtime secret store
on a deployment that enforces HTTPS. The same username/password protects
pages, all application APIs and the AI server action. The Next.js proxy is a
coarse first check; the server action independently checks the same secret
before invoking the paid model. It never logs credentials. Invalid or empty
configuration returns 503 for protected routes instead of switching to open.

Only `/api/health` and framework static assets are intentionally unauthenticated.

## Explicit non-guarantees

- HTTP Basic sends its password with **every request**. Never run it on public
  cleartext HTTP. The localhost-only test server uses HTTP to avoid public
  secrets; CI credentials are fixed, dummy strings.
- The failed-login limiter counts **globally per server process** rather than
  consulting spoofable `x-forwarded-for` or `x-real-ip` request headers.
  This prevents trivial header-rotation bypass of *this* limiter, but 10 wrong
  attempts can lock out everyone for a minute. Multi-instance deployments
  do not share failure counts. It is **not** an internet-scale brute-force
  defense. Place a rate-limiting WAF and trusted platform SSO / VPN ahead of
  public deployments.
- A shared password cannot distinguish which person submitted operator
  feedback; it is not account management, audit identity, RBAC or OT security.
- Pre-existing API and AI cost-brake rate limits still trust forwarded headers
  and remain best-effort. They must not be presented as strong WAF policies.
- Never configure `DEMO_BASIC_AUTH` or real Gemini keys in Git history.
  On credential compromise, rotate the secret and restart/redeploy the service.

## CI and production release

- Automated CircleCI `web-quality`, `analysis-quality`, `browser-e2e` and
  GitHub Docker, CodeQL, pip/npm audit and Gitleaks must pass on the exact head.
- In CI only, Playwright runs a second `localhost` server with dummy credentials
  to validate anonymous and authenticated behavior for dashboard, offline
  replay, APIs, feedback and health probe. This does not prove public ingress.
- Verify HTTPS/TLS redirect, browser-access boundaries, deployment provider's
  WAF/SSO, secret storage and reverse-proxy behavior on the published URL.
- Protect `main` with required checks in GitHub repository settings. The app
  integration currently lacks branch-protection administration; checks must
  remain a manual merge gate until settings are established.
- Never attach PLCs or grant a network route from the demo to a control network.

A deployed site requiring organizational identity needs a real identity
provider/platform deployment protection. The built-in shared gate is an
optional **portfolio-only** feature.
