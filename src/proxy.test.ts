/** @jest-environment node */
import { NextRequest } from 'next/server';
import { config, failedAttempts, proxy, REALM } from '@/proxy';

const CREDENTIALS = 'operator:correct-horse-battery';
const basic = (raw: string) => `Basic ${Buffer.from(raw).toString('base64')}`;

function request(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/metrics', { headers });
}

// NextResponse.next() marks a pass-through with this header.
const passedThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';

describe('proxy (DEMO_BASIC_AUTH)', () => {
  const original = process.env.DEMO_BASIC_AUTH;
  let ip = 0;
  // A fresh client per test so failed attempts in one test do not lock out the next.
  const client = () => ({ 'x-forwarded-for': `203.0.113.${++ip}` });

  afterEach(() => {
    if (original === undefined) delete process.env.DEMO_BASIC_AUTH;
    else process.env.DEMO_BASIC_AUTH = original;
    jest.restoreAllMocks();
  });

  it('passes every request through when the variable is not set', async () => {
    delete process.env.DEMO_BASIC_AUTH;
    expect(passedThrough(await proxy(request()))).toBe(true);
  });

  describe('when set', () => {
    beforeEach(() => {
      process.env.DEMO_BASIC_AUTH = CREDENTIALS;
    });

    it('challenges a request without credentials', async () => {
      const res = await proxy(request(client()));
      expect(res.status).toBe(401);
      expect(res.headers.get('WWW-Authenticate')).toBe(`Basic realm="${REALM}", charset="UTF-8"`);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(passedThrough(res)).toBe(false);
    });

    it('lets the right credentials through', async () => {
      const res = await proxy(request({ ...client(), authorization: basic(CREDENTIALS) }));
      expect(passedThrough(res)).toBe(true);
    });

    it('rejects wrong credentials', async () => {
      const res = await proxy(request({ ...client(), authorization: basic('operator:wrong-password-1') }));
      expect(res.status).toBe(401);
      expect(passedThrough(res)).toBe(false);
    });

    it('stops checking after 10 wrong guesses, even if the next one is right', async () => {
      const headers = client();
      for (let i = 0; i < 10; i++) {
        const res = await proxy(request({ ...headers, authorization: basic(`operator:guess-number-${i}`) }));
        expect(res.status).toBe(401);
      }
      const locked = await proxy(request({ ...headers, authorization: basic(CREDENTIALS) }));
      expect(locked.status).toBe(429);
      expect(locked.headers.get('Retry-After')).toBe('60');
      // Another client is unaffected.
      expect(passedThrough(await proxy(request({ ...client(), authorization: basic(CREDENTIALS) })))).toBe(true);
    });

    it('does not count requests that send no credentials', async () => {
      const headers = client();
      for (let i = 0; i < 15; i++) await proxy(request(headers));
      expect(failedAttempts.isLimited(headers['x-forwarded-for'])).toBe(false);
      expect(passedThrough(await proxy(request({ ...headers, authorization: basic(CREDENTIALS) })))).toBe(true);
    });
  });

  it('fails closed with 503 when the value is malformed, without logging it', async () => {
    process.env.DEMO_BASIC_AUTH = 'operator:short';
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await proxy(request({ ...client(), authorization: basic('operator:short') }));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('short');
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).not.toContain('short');
  });

  it('leaves the health probe and build assets outside the matcher', () => {
    const pattern = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ['/', '/case-study', '/api/metrics', '/api/feedback/summary']) {
      expect(pattern.test(path)).toBe(true);
    }
    for (const path of ['/api/health', '/_next/static/chunks/app.js', '/favicon.ico']) {
      expect(pattern.test(path)).toBe(false);
    }
  });
});
