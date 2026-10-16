/** @jest-environment node */
import { NextRequest } from 'next/server';
import { evaluateDemoProxy, config } from '@/proxy';
import { DemoFailureGate } from '@/lib/demo-auth';

const CONFIG = 'operator:correct-horse-battery';
const basic = (value: string) => `Basic ${Buffer.from(value, 'utf8').toString('base64')}`;
const request = (path = '/api/metrics', headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:9002${path}`, { headers });
const accepted = (response: Response) => response.headers.get('x-middleware-next') === '1';

describe('opt-in synthetic demonstration proxy', () => {
  const before = process.env.DEMO_BASIC_AUTH;
  beforeEach(() => { process.env.DEMO_BASIC_AUTH = CONFIG; });
  afterAll(() => {
    if (before === undefined) delete process.env.DEMO_BASIC_AUTH;
    else process.env.DEMO_BASIC_AUTH = before;
  });

  it('allows open demo only when config is absent', async () => {
    delete process.env.DEMO_BASIC_AUTH;
    expect(accepted(await evaluateDemoProxy(request(), new DemoFailureGate()))).toBe(true);
  });

  it('denies misconfigured secret without revealing its value', async () => {
    process.env.DEMO_BASIC_AUTH = 'operator:short';
    const res = await evaluateDemoProxy(request(), new DemoFailureGate());
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('short');
  });

  it('blocks pages, API calls and server actions when unauthenticated', async () => {
    const gate = new DemoFailureGate();
    for (const path of ['/', '/offline-replay', '/case-study', '/api/metrics', '/api/feedback']) {
      const res = await evaluateDemoProxy(request(path), gate);
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain('OT-Sentinel synthetic demo');
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(accepted(await evaluateDemoProxy(
      request('/offline-replay', { authorization: basic(CONFIG) }), gate
    ))).toBe(true);
  });

  it('does not permit x-forwarded-for or x-real-ip rotation to bypass the global failed-login gate', async () => {
    const gate = new DemoFailureGate(3, 60_000);
    for (let n = 0; n < 3; n++) {
      const headers = {
        authorization: basic('operator:bad-password-long'),
        'x-forwarded-for': `198.51.100.${n}`,
        'x-real-ip': `192.0.2.${n}`,
      };
      expect((await evaluateDemoProxy(request('/', headers), gate)).status).toBe(401);
    }
    const blocked = await evaluateDemoProxy(request('/', {
      authorization: basic(CONFIG), 'x-forwarded-for': '203.0.113.220',
    }), gate);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
  });

  it('does not count absent credentials as password guesses', async () => {
    const gate = new DemoFailureGate(1, 60_000);
    for (let n = 0; n < 20; n++) {
      expect((await evaluateDemoProxy(request(), gate)).status).toBe(401);
    }
    expect(gate.isBlocked()).toBe(false);
    expect(accepted(await evaluateDemoProxy(
      request('/', { authorization: basic(CONFIG) }), gate
    ))).toBe(true);
  });

  it('matches application routes but excludes only the actual health probe and static files', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ['/', '/case-study', '/offline-replay', '/api/metrics',
      '/api/feedback', '/api/feedback/summary', '/api/healthcheck']) {
      expect(matcher.test(new URL(path, 'http://localhost:9002').pathname)).toBe(true);
    }
    for (const path of ['/api/health', '/_next/static/chunk.js',
      '/_next/image?url=x', '/favicon.ico']) {
      expect(matcher.test(new URL(path, 'http://localhost:9002').pathname)).toBe(false);
    }
  });
});
