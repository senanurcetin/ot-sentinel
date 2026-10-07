/** @jest-environment node */
import { NextRequest } from 'next/server';
import { clientKey, enforceRateLimit, RateLimiter } from '@/lib/rate-limit';

describe('RateLimiter', () => {
  it('allows up to the limit, then blocks until the window resets', () => {
    let now = 1_000;
    const limiter = new RateLimiter(3, 60_000, () => now);
    expect([1, 2, 3].map(() => limiter.check('a').allowed)).toEqual([true, true, true]);
    const blocked = limiter.check('a');
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    expect(blocked.retryAfterSeconds).toBe(60);

    now += 60_000;
    expect(limiter.check('a').allowed).toBe(true);
  });

  it('counts each client separately and reports remaining calls', () => {
    const limiter = new RateLimiter(2, 1_000, () => 0);
    expect(limiter.check('a').remaining).toBe(1);
    expect(limiter.check('b').remaining).toBe(1);
    expect(limiter.check('a').remaining).toBe(0);
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('reports Retry-After as the time left in the window', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 10_000, () => now);
    limiter.check('a');
    now = 7_500;
    expect(limiter.check('a').retryAfterSeconds).toBe(3);
  });

  it('does not grow without bound under many distinct keys', () => {
    const now = 0;
    const limiter = new RateLimiter(5, 60_000, () => now, 3);
    ['a', 'b', 'c'].forEach((k) => expect(limiter.check(k).allowed).toBe(true));
    expect(limiter.check('d').allowed).toBe(false); // table full of live windows
    expect(limiter.check('a').allowed).toBe(true); // existing clients are unaffected
  });

  it('evicts expired windows to make room', () => {
    let now = 0;
    const limiter = new RateLimiter(5, 1_000, () => now, 2);
    limiter.check('a');
    limiter.check('b');
    now = 5_000;
    expect(limiter.check('c').allowed).toBe(true);
  });
});

describe('clientKey', () => {
  it('uses the first x-forwarded-for hop, then x-real-ip, then "unknown"', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientKey(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientKey(new Headers())).toBe('unknown');
  });
});

describe('enforceRateLimit', () => {
  it('returns null while allowed and a 429 with Retry-After when exceeded', async () => {
    const limiter = new RateLimiter(1, 60_000, () => 0);
    const req = () => new NextRequest('http://localhost/api/x', { headers: { 'x-forwarded-for': '1.2.3.4' } });
    expect(enforceRateLimit(req(), limiter)).toBeNull();
    const res = enforceRateLimit(req(), limiter)!;
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Too many requests' });
  });
});
