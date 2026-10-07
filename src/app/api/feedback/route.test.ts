/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';

let ipCounter = 0;
const post = (body: string, ip = `192.0.2.${++ipCounter}`, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, ...headers },
      body,
    })
  );

describe('POST /api/feedback', () => {
  it('accepts a valid verdict', async () => {
    const res = await post(
      JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', verdict: 'false_alarm', note: 'maintenance' })
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ received: true });
  });

  it('rejects an unknown verdict with 422', async () => {
    const res = await post(JSON.stringify({ timestamp: 't', verdict: 'maybe' }));
    expect(res.status).toBe(422);
  });

  it('rejects an oversized note with 422', async () => {
    const res = await post(
      JSON.stringify({ timestamp: 't', verdict: 'confirmed_threat', note: 'x'.repeat(501) })
    );
    expect(res.status).toBe(422);
  });

  it('rejects malformed JSON with 400', async () => {
    expect((await post('{not json')).status).toBe(400);
  });

  it('rejects a body over 4 KB with 413 without parsing it', async () => {
    const res = await post(JSON.stringify({ timestamp: 't', verdict: 'false_alarm', note: 'x'.repeat(5000) }));
    expect(res.status).toBe(413);
  });

  it('rejects a request whose declared length is already over the limit', async () => {
    const res = await post('{}', undefined, { 'content-length': '999999' });
    expect(res.status).toBe(413);
  });

  it('returns 429 after 30 requests per minute from one client', async () => {
    const ip = '198.51.100.7';
    const ok = JSON.stringify({ timestamp: 't', verdict: 'false_alarm' });
    const statuses = [];
    for (let i = 0; i < 31; i++) statuses.push((await post(ok, ip)).status);
    expect(statuses.slice(0, 30).every((s) => s === 202)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('marks responses as not cacheable', async () => {
    const res = await post(JSON.stringify({ timestamp: 't', verdict: 'false_alarm' }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('feedback storage and summary', () => {
  // Imported lazily so the module-level limiter of the summary route is fresh per file.
  const { GET } = jest.requireActual('./summary/route') as typeof import('./summary/route');
  const store = jest.requireActual('@/lib/feedback-store') as typeof import('@/lib/feedback-store');
  const summary = (ip = `198.51.100.${++ipCounter}`) =>
    GET(new NextRequest('http://localhost/api/feedback/summary', { headers: { 'x-forwarded-for': ip } }));

  beforeEach(() => store.resetFeedbackStore());
  afterAll(() => store.resetFeedbackStore());

  it('stores verdicts with their detector context and reports them in the summary', async () => {
    await post(JSON.stringify({ timestamp: 't1', verdict: 'false_alarm', top_sensor: 'temp', risk_score: 61 }));
    await post(JSON.stringify({ timestamp: 't2', verdict: 'confirmed_threat', top_sensor: 'vibration', note: 'secret' }));
    const res = await summary();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body).toMatchObject({
      storage: 'memory',
      total: 2,
      false_alarm: 1,
      by_top_sensor: [
        { sensor: 'temp', total: 1, false_alarm: 1 },
        { sensor: 'vibration', total: 1, false_alarm: 0 },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('rejects a sensor the scorer does not know, so stored keys stay bounded', async () => {
    const res = await post(JSON.stringify({ timestamp: 't', verdict: 'false_alarm', top_sensor: 'x'.repeat(40) }));
    expect(res.status).toBe(422);
  });

  it('rejects a risk score outside 0-100', async () => {
    expect((await post(JSON.stringify({ timestamp: 't', verdict: 'false_alarm', risk_score: 101 }))).status).toBe(422);
  });

  it('answers 500 without internals when the database cannot be opened', async () => {
    const original = process.env.FEEDBACK_DB_PATH;
    process.env.FEEDBACK_DB_PATH = '/nonexistent-dir/ot-sentinel/feedback.db';
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await post(JSON.stringify({ timestamp: 't', verdict: 'false_alarm' }));
      expect(res.status).toBe(500);
      expect(JSON.stringify(await res.json())).not.toMatch(/nonexistent|sqlite|unable/i);
      expect((await summary()).status).toBe(500);
    } finally {
      if (original === undefined) delete process.env.FEEDBACK_DB_PATH;
      else process.env.FEEDBACK_DB_PATH = original;
      quiet.mockRestore();
    }
  });
});
