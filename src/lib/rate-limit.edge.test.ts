/** @jest-environment node */
import { NextRequest } from 'next/server';
import { clientKey, enforceRateLimit, RateLimiter } from '@/lib/rate-limit';

describe('fixed-window rate limit boundary regressions', () => {
  it('does not reset a window a millisecond before expiry', () => {
    let now = 10_000;
    const limiter = new RateLimiter(1, 1_000, () => now);
    expect(limiter.check('device-a')).toMatchObject({ allowed: true, remaining: 0 });
    now = 10_999;
    expect(limiter.check('device-a')).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1,
    });
    now = 11_000;
    expect(limiter.check('device-a')).toMatchObject({
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 1,
    });
  });

  it('keeps a denied client blocked during the same window despite repeated requests', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 5_000, () => now);
    expect(limiter.check('plant-1').allowed).toBe(true);
    expect(limiter.check('plant-1').allowed).toBe(true);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(limiter.check('plant-1').allowed).toBe(false);
    }
    now = 4_999;
    expect(limiter.check('plant-1').retryAfterSeconds).toBe(1);
    now = 5_000;
    expect(limiter.check('plant-1').allowed).toBe(true);
  });

  it('does not admit a new key when the table is full of live windows', () => {
    let now = 50;
    const limiter = new RateLimiter(2, 1_000, () => now, 2);
    limiter.check('source-a');
    limiter.check('source-b');

    const denied = limiter.check('source-c');
    expect(denied).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
    // Existing keys retain their own quota even while the key map is full.
    expect(limiter.check('source-a')).toMatchObject({ allowed: true, remaining: 0 });

    now = 1_050;
    // Eviction happens on admission; expired entries are removed and the new key may enter.
    expect(limiter.check('source-c')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check('source-b')).toMatchObject({ allowed: true, remaining: 1 });
  });

  it('maintains separate counters for keys with similar prefixes', () => {
    const limiter = new RateLimiter(1, 60_000, () => 0);
    expect(limiter.check('10.0.0.1').allowed).toBe(true);
    expect(limiter.check('10.0.0.10').allowed).toBe(true);
    expect(limiter.check('10.0.0.1').allowed).toBe(false);
    expect(limiter.check('10.0.0.10').allowed).toBe(false);
  });

  it('uses x-real-ip when x-forwarded-for has no usable first hop', () => {
    expect(clientKey(new Headers({
      'x-forwarded-for': '  , 203.0.113.2',
      'x-real-ip': '198.51.100.9',
    }))).toBe('198.51.100.9');
  });

  it('groups clients without a usable IP under the documented unknown key', () => {
    const limiter = new RateLimiter(1, 10_000, () => 0);
    expect(clientKey(new Headers())).toBe('unknown');
    expect(limiter.check(clientKey(new Headers())).allowed).toBe(true);
    expect(limiter.check(clientKey(new Headers())).allowed).toBe(false);
  });

  it('returns an integer Retry-After that follows the remaining window', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 5_500, () => now);
    const request = () =>
      new NextRequest('http://localhost/api/data', {
        headers: { 'x-forwarded-for': '203.0.113.7' },
      });

    expect(enforceRateLimit(request(), limiter)).toBeNull();
    now = 501;
    let result = enforceRateLimit(request(), limiter);
    expect(result?.status).toBe(429);
    expect(result?.headers.get('Retry-After')).toBe('5');
    expect(result?.headers.get('Cache-Control')).toBe('no-store');

    now = 5_499;
    result = enforceRateLimit(request(), limiter);
    expect(result?.headers.get('Retry-After')).toBe('1');

    now = 5_500;
    expect(enforceRateLimit(request(), limiter)).toBeNull();
  });
});
