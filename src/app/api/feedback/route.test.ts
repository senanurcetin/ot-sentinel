/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';

const post = (body: string) =>
  POST(
    new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
});
