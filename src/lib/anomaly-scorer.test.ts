import params from '@/data/model/scorer-params.json';
import { buildLogEntry, scoreMetrics, type SensorReadings } from '@/lib/anomaly-scorer';

/** Readings that sit `k` standard deviations above the baseline mean on every sensor. */
const atSigma = (k: number): SensorReadings => ({
  temp: params.sensors.temp.mean + k * params.sensors.temp.std,
  pressure: params.sensors.pressure.mean + k * params.sensors.pressure.std,
  vibration: params.sensors.vibration.mean + k * params.sensors.vibration.std,
});

describe('scorer parameters', () => {
  it('weights sum to 1 and every std is positive', () => {
    const sensors = Object.values(params.sensors);
    expect(sensors.reduce((sum, s) => sum + s.weight, 0)).toBeCloseTo(1, 9);
    sensors.forEach((s) => expect(s.std).toBeGreaterThan(0));
  });
});

describe('scoreMetrics', () => {
  // Reference points from the documented risk table in analysis/model-params.json:
  // composite z of 0 -> 0, 1 -> 22, 3 -> 53 (status flips to CRITICAL at 50).
  it.each([
    [0, 0, 'SECURE'],
    [1, 22, 'SECURE'],
    [3, 53, 'CRITICAL'],
  ] as const)('all sensors at %i sigma -> risk %i (%s)', (sigma, risk, status) => {
    const result = scoreMetrics(atSigma(sigma));
    expect(result.risk_score).toBe(risk);
    expect(result.status).toBe(status);
  });

  it('is symmetric: below the mean scores the same as above it', () => {
    expect(scoreMetrics(atSigma(-2)).risk_score).toBe(scoreMetrics(atSigma(2)).risk_score);
  });

  it('risk grows monotonically with deviation and stays within 0-100', () => {
    const risks = [0, 0.5, 1, 2, 4, 8, 50].map((k) => scoreMetrics(atSigma(k)).risk_score);
    risks.forEach((r, i) => {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(100);
      if (i > 0) expect(r).toBeGreaterThanOrEqual(risks[i - 1]);
    });
  });

  it('keeps anomaly_score inside [0.01, 0.99]', () => {
    expect(scoreMetrics(atSigma(0)).anomaly_score).toBe(0.01);
    expect(scoreMetrics(atSigma(1000)).anomaly_score).toBe(0.99);
  });

  it('attributes the anomaly to the sensor that deviates', () => {
    const readings = atSigma(0);
    readings.vibration = params.sensors.vibration.mean + 10 * params.sensors.vibration.std;
    const { per_sensor_contributions: c } = scoreMetrics(readings);
    expect(c[0].sensor).toBe('vibration');
    expect(c[0].status).toBe('critical');
    expect(c[0].z_score).toBeCloseTo(10, 1);
    expect(c.slice(1).every((x) => x.status === 'normal')).toBe(true);
    expect(c.reduce((sum, x) => sum + x.contribution_pct, 0)).toBeCloseTo(100, 0);
  });

  it('classifies per-sensor status at the warning and critical z thresholds', () => {
    const warn = scoreMetrics({
      ...atSigma(0),
      temp: params.sensors.temp.mean + 2.5 * params.sensors.temp.std,
    });
    expect(warn.per_sensor_contributions.find((x) => x.sensor === 'temp')?.status).toBe('warning');
  });

  it('stays finite and saturates at 100 for absurdly large readings', () => {
    const result = scoreMetrics({ temp: 1e9, pressure: -1e9, vibration: 1e9 });
    expect(Number.isNaN(result.risk_score)).toBe(false);
    expect(result.risk_score).toBe(100);
    expect(result.status).toBe('CRITICAL');
  });
});

describe('buildLogEntry', () => {
  it('names the primary driver when critical', () => {
    const entry = buildLogEntry(scoreMetrics(atSigma(5)), '203.0.113.45');
    expect(entry).toContain('ANOMALY DETECTED');
    expect(entry).toContain('203.0.113.45');
    expect(entry).toMatch(/Primary driver: (temp|pressure|vibration)/);
  });

  it('reports an advisory for a warning below the critical line', () => {
    const readings = atSigma(0);
    readings.temp = params.sensors.temp.mean + 2.5 * params.sensors.temp.std;
    expect(buildLogEntry(scoreMetrics(readings), '10.0.0.5')).toMatch(/^Advisory: temp/);
  });

  it('reports OK for nominal readings', () => {
    expect(buildLogEntry(scoreMetrics(atSigma(0)), '10.0.0.5')).toMatch(/Status check OK/);
  });
});
