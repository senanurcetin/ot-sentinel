/** @jest-environment node */
import {
  DemoFailureGate, decodeDemoBasicAuth, demoCredentialsMatch,
  demoRequestAuthorized, parseDemoAuthConfig,
} from '@/lib/demo-auth';

const basic = (value: string) => `Basic ${Buffer.from(value, 'utf8').toString('base64')}`;
const CONFIG = 'operator:correct-horse-battery';

describe('strict shared-demo config and Basic credentials', () => {
  it('leaves the demo open ONLY when the env var is absent', () => {
    expect(parseDemoAuthConfig(undefined)).toEqual({ mode: 'open' });
    expect(parseDemoAuthConfig('')).toEqual({ mode: 'misconfigured' });
    expect(parseDemoAuthConfig('operator')).toEqual({ mode: 'misconfigured' });
  });

  it('supports colons in passwords but rejects short, oversized and control data', () => {
    expect(parseDemoAuthConfig('operator:pass:with:colon-and-length')).toEqual({
      mode: 'protected',
      credentials: { username: 'operator', password: 'pass:with:colon-and-length' },
    });
    for (const bad of ['operator:short', ':password-longer-than-sixteen',
      `x${'x'.repeat(81)}:very-long-password-abc`,
      `operator:${'a'.repeat(513)}`,
      'operator:password-long\nunsafe']) {
      expect(parseDemoAuthConfig(bad).mode).toBe('misconfigured');
    }
    expect(parseDemoAuthConfig('operator:1234567890123456').mode).toBe('protected');
  });

  it('parses strict UTF-8 header without accepting invalid encodings or different schemes', () => {
    expect(decodeDemoBasicAuth(basic('op:şifre:very-long'))).toEqual({
      username: 'op', password: 'şifre:very-long',
    });
    for (const invalid of [null, 'Bearer abc', 'Basic %%%', basic('not-a-pair'),
      `Basic ${Buffer.from([0x6f, 0x70, 0x3a, 0xff]).toString('base64')}`,
      'Basic ' + 'a'.repeat(2100)]) {
      expect(decodeDemoBasicAuth(invalid)).toBeNull();
    }
  });

  it('compares username and password, including wrong-length secrets, without treating hash as identity', async () => {
    const expected = { username: 'operator', password: 'correct-horse-battery' };
    await expect(demoCredentialsMatch({ ...expected }, expected)).resolves.toBe(true);
    await expect(demoCredentialsMatch({ ...expected, username: 'Operator' }, expected)).resolves.toBe(false);
    await expect(demoCredentialsMatch({ ...expected, password: 'short' }, expected)).resolves.toBe(false);
    await expect(demoRequestAuthorized(parseDemoAuthConfig(CONFIG), basic(CONFIG))).resolves.toBe(true);
    await expect(demoRequestAuthorized(parseDemoAuthConfig(CONFIG), basic('operator:wrong'))).resolves.toBe(false);
    await expect(demoRequestAuthorized(parseDemoAuthConfig(''), basic(CONFIG))).resolves.toBe(false);
    await expect(demoRequestAuthorized(parseDemoAuthConfig(undefined), null)).resolves.toBe(true);
  });
});

describe('global per-process demo failure counter', () => {
  it('counts only recorded failures and clears on the next window', () => {
    let now = 0;
    const gate = new DemoFailureGate(2, 1_000, () => now);
    expect(gate.isBlocked()).toBe(false);
    gate.recordFailure();
    expect(gate.isBlocked()).toBe(false);
    gate.recordFailure();
    expect(gate.isBlocked()).toBe(true);
    now += 999;
    expect(gate.isBlocked()).toBe(true);
    now += 1;
    expect(gate.isBlocked()).toBe(false);
  });
});
