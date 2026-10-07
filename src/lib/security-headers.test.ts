import { buildCsp, securityHeaders } from '@/lib/security-headers';

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `))?.slice(name.length + 1).split(' ') ?? [];

describe('buildCsp', () => {
  it('locks down framing, plugins, base URI and form targets', () => {
    const csp = buildCsp(false);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
  });

  it('only allows same-origin connections in production', () => {
    expect(directive(buildCsp(false), 'connect-src')).toEqual(["'self'"]);
  });

  it("allows 'unsafe-eval' only in development", () => {
    expect(directive(buildCsp(false), 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(buildCsp(true), 'script-src')).toContain("'unsafe-eval'");
  });

  it('restricts remote hosts to the fonts and images the app actually uses', () => {
    const csp = buildCsp(false);
    expect(directive(csp, 'style-src')).toContain('https://fonts.googleapis.com');
    expect(directive(csp, 'font-src')).toContain('https://fonts.gstatic.com');
    expect(directive(csp, 'img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(csp).not.toMatch(/\*/); // no wildcards
  });
});

describe('securityHeaders', () => {
  const byKey = (isDev: boolean) => Object.fromEntries(securityHeaders(isDev).map((h) => [h.key, h.value]));

  it('sets the standard hardening headers', () => {
    const headers = byKey(false);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d{8,}/);
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
  });

  it('has no duplicate header names', () => {
    const keys = securityHeaders(false).map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
