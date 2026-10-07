/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { syntheticSource } from '@/lib/telemetry-source';

let ipCounter = 0;
/** Each call gets its own client IP so the module-level rate limiter does not couple tests. */
const call = (query = '', ip = `192.0.2.${++ipCounter}`) =>
  GET(new NextRequest(`http://localhost/api/metrics${query}`, { headers: { 'x-forwarded-for': ip } }));

describe('GET /api/metrics', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a nominal, SECURE sample by default', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // centre of every normal range
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('SECURE');
    expect(body.risk_score).toBeLessThan(50);
    expect(body.metrics.temp).toBeGreaterThanOrEqual(40);
    expect(body.metrics.temp).toBeLessThanOrEqual(60);
  });

  it('returns a CRITICAL sample when attack=true, scored by the detector', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const body = await (await call('?attack=true')).json();
    expect(body.status).toBe('CRITICAL');
    expect(body.risk_score).toBeGreaterThanOrEqual(50);
    expect(body.per_sensor_contributions).toHaveLength(3);
    expect(body.log_entry).toContain('ANOMALY DETECTED');
  });

  it('accepts attack=false explicitly', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect((await (await call('?attack=false')).json()).status).toBe('SECURE');
  });

  it.each(['?attack=yes', '?attack=1', '?attack=TRUE', '?attack='])('rejects invalid query %s with 400', async (q) => {
    const res = await call(q);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid query');
  });

  it('never caches telemetry', async () => {
    expect((await call()).headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 429 with Retry-After once a client exceeds 180 requests per minute', async () => {
    const ip = '198.51.100.99';
    const statuses = [];
    for (let i = 0; i < 181; i++) statuses.push((await call('', ip)).status);
    expect(statuses.slice(0, 180).every((s) => s === 200)).toBe(true);
    expect(statuses[180]).toBe(429);
    expect((await call('', ip)).headers.get('Retry-After')).toMatch(/^\d+$/);
    // another client is unaffected
    expect((await call('', '198.51.100.100')).status).toBe(200);
  });

  it('hides internal errors from the client', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(syntheticSource, 'next').mockImplementation(() => {
      throw new Error('secret internal detail');
    });
    const res = await call();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret internal detail');
  });

  it('exposes the full Metrics contract', async () => {
    const body = await (await call()).json();
    expect(Object.keys(body).sort()).toEqual(
      [
        'anomaly_score',
        'log_entry',
        'metrics',
        'network_traffic',
        'per_sensor_contributions',
        'risk_score',
        'status',
        'timestamp',
        'traffic_volume',
      ].sort()
    );
  });
});
