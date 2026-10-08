/**
 * HTTP security headers applied to every route (see next.config.ts).
 *
 * The CSP allows 'unsafe-inline' scripts because the Next.js App Router injects inline bootstrap
 * scripts and the proxy (src/proxy.ts) does not mint per-request nonces. That weakens script
 * injection protection; moving to nonces is the documented next step (docs/threat-model.md).
 * Styles need 'unsafe-inline' for Radix/Recharts inline style attributes.
 */
export type HeaderRule = { key: string; value: string };

export function buildCsp(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-eval' only in development, where React/Turbopack need it for error overlays.
    'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    // No remote images: every icon is inline SVG and charts render locally.
    'img-src': ["'self'", 'data:', 'blob:'],
    // Telemetry and feedback are same-origin; Gemini is called server-side only.
    'connect-src': ["'self'", ...(isDev ? ['ws:', 'http:'] : [])],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export function securityHeaders(isDev = process.env.NODE_ENV !== 'production'): HeaderRule[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(isDev) },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}
