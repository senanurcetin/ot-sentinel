/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';

const call = (query = '') => GET(new NextRequest(`http://localhost/api/metrics${query}`));

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

  it('treats anything other than attack=true as normal operation', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const body = await (await call('?attack=yes')).json();
    expect(body.status).toBe('SECURE');
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
