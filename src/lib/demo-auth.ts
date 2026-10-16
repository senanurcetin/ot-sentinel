/**
 * Optional shared-secret gate for a SYNTHETIC public demonstration.
 * No identities/roles; do not use as production OT authorization.
 * Authentication happens only on the server. Never log credentials.
 */
export type DemoCredentials = { username: string; password: string };
export type DemoAuthMode =
  | { mode: 'open' }
  | { mode: 'misconfigured' }
  | { mode: 'protected'; credentials: DemoCredentials };

export const MIN_DEMO_PASSWORD_LENGTH = 16;
const MAX_AUTH_HEADER_LENGTH = 2048;

export function parseDemoAuthConfig(value: string | undefined): DemoAuthMode {
  if (value === undefined) return { mode: 'open' };
  // An explicitly configured but blank value MUST NOT accidentally open a private demo.
  const delimiter = value.indexOf(':');
  const username = value.slice(0, delimiter);
  const password = value.slice(delimiter + 1);
  if (delimiter < 1 || username.length > 80 ||
      password.length < MIN_DEMO_PASSWORD_LENGTH || password.length > 512 ||
      /[\u0000-\u001f\u007f]/.test(value)) {
    return { mode: 'misconfigured' };
  }
  return { mode: 'protected', credentials: { username, password } };
}

export function decodeDemoBasicAuth(header: string | null): DemoCredentials | null {
  if (!header || header.length > MAX_AUTH_HEADER_LENGTH) return null;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]), c => c.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const colon = decoded.indexOf(':');
    if (colon < 1) return null;
    return { username: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

export async function demoCredentialsMatch(
  provided: DemoCredentials, expected: DemoCredentials
): Promise<boolean> {
  // Hash both sides of both values, even on a wrong username.
  const [userActual, userExpected, passActual, passExpected] = await Promise.all([
    sha256(provided.username), sha256(expected.username),
    sha256(provided.password), sha256(expected.password),
  ]);
  let mismatch = 0;
  for (let i = 0; i < userActual.length; i++) {
    mismatch |= userActual[i] ^ userExpected[i];
    mismatch |= passActual[i] ^ passExpected[i];
  }
  return mismatch === 0;
}

export async function demoRequestAuthorized(
  config: DemoAuthMode, header: string | null
): Promise<boolean> {
  if (config.mode === 'open') return true;
  if (config.mode !== 'protected') return false;
  const provided = decodeDemoBasicAuth(header);
  return !!provided && demoCredentialsMatch(provided, config.credentials);
}

/**
 * Per-process fixed-window count of FAILED logins; no client IP headers used.
 * Limits brute-force on a single demo process, but a malicious user may cause
 * GLOBAL lockout. Multi-replica deployments require ingress WAF/SSO instead.
 */
export class DemoFailureGate {
  private failures = 0;
  private resetsAt = 0;
  constructor(
    private readonly limit = 10,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now
  ) {}

  isBlocked(): boolean {
    const t = this.now();
    if (t >= this.resetsAt) {
      this.failures = 0;
      this.resetsAt = t + this.windowMs;
    }
    return this.failures >= this.limit;
  }

  recordFailure(): void {
    this.isBlocked(); // resets expired window
    this.failures = Math.min(this.limit, this.failures + 1);
  }
}
