/**
 * Optional HTTP Basic authentication for a public demo deployment (see src/proxy.ts).
 *
 * `DEMO_BASIC_AUTH` holds `user:password`. Unset or empty: the demo stays open, as before. Set but
 * malformed or with a short password: every protected request is refused (fail closed), so a typo
 * never silently publishes a deployment that was meant to be private.
 *
 * Basic auth sends the password with every request; it is only safe over HTTPS (Vercel and any
 * TLS-terminating proxy provide that). It is a gate for a demo, not user management.
 */
export const MIN_PASSWORD_LENGTH = 12;

export type Credentials = { user: string; password: string };

export type AuthConfig =
  | { mode: 'open' }
  | { mode: 'protected'; credentials: Credentials }
  | { mode: 'misconfigured' };

export function parseAuthConfig(value: string | undefined): AuthConfig {
  if (!value) return { mode: 'open' };
  const credentials = splitCredentials(value);
  if (!credentials || credentials.password.length < MIN_PASSWORD_LENGTH) {
    return { mode: 'misconfigured' };
  }
  return { mode: 'protected', credentials };
}

/** Splits at the first colon: user names cannot contain one, passwords can (RFC 7617). */
function splitCredentials(value: string): Credentials | null {
  const i = value.indexOf(':');
  if (i <= 0) return null;
  return { user: value.slice(0, i), password: value.slice(i + 1) };
}

/** Decodes an `Authorization: Basic …` header; null when absent or not valid Basic credentials. */
export function parseBasicHeader(header: string | null): Credentials | null {
  const match = header?.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
    return splitCredentials(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/**
 * Compares in time independent of where the inputs differ: both sides are hashed to 32 bytes
 * first, so neither the content nor the length of the secret leaks through timing.
 */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function credentialsMatch(given: Credentials, expected: Credentials): Promise<boolean> {
  // Evaluate both so a wrong user name costs the same as a wrong password.
  const [user, password] = await Promise.all([
    safeEqual(given.user, expected.user),
    safeEqual(given.password, expected.password),
  ]);
  return user && password;
}
