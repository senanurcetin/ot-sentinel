/** @jest-environment node */
import { RecordedTelemetrySource, MAX_REPLAY_ROWS } from '@/lib/recorded-telemetry';

const row = (timestamp: string, temp = 50) => ({
  timestamp, metrics: { temp, pressure: 1010, vibration: 0.055 },
});

describe('bounded offline three-sensor replay', () => {
  it('returns deterministic source timestamps and model-derived risk, then stops at EOF', () => {
    const original = [
      row('2026-10-16T10:00:00Z'),
      row('2026-10-16T10:00:01.000Z', 130),
    ];
    const replay = new RecordedTelemetrySource(original);
    const first = replay.next('attack'); // mode cannot alter historical values
    expect(first.timestamp).toBe(original[0].timestamp);
    expect(first.metrics.temp).toBe(50);
    expect(first.status).toBe('SECURE');
    expect(first.network_traffic).toContain('NOT RECORDED');
    expect(first.log_entry).toContain('OFFLINE THREE-SENSOR REPLAY');
    const second = replay.next('normal');
    expect(second.timestamp).toBe(original[1].timestamp);
    expect(second.metrics.temp).toBe(130);
    expect(second.status).toBe('CRITICAL');
    expect(second.risk_score).toBeGreaterThan(first.risk_score);
    expect(() => replay.next('normal')).toThrow('exhausted');
  });

  it('takes a snapshot and never leaks its internal objects to callers', () => {
    const original = [row('2026-10-16T10:00:00Z')];
    const firstRun = new RecordedTelemetrySource(original);
    original[0].metrics.temp = 999;
    const sample = firstRun.next('normal');
    expect(sample.metrics.temp).toBe(50);
    sample.metrics.temp = -999;
    sample.per_sensor_contributions[0].z_score = 999;
    const secondRun = new RecordedTelemetrySource([row('2026-10-16T10:00:00Z')]);
    expect(secondRun.next('normal').metrics.temp).toBe(50);
  });

  it('rejects empty recordings and enforces a deterministic maximum', () => {
    expect(() => new RecordedTelemetrySource([])).toThrow(RangeError);
    const many = Array.from({ length: MAX_REPLAY_ROWS + 1 },
      (_, i) => row(new Date(Date.UTC(2026, 9, 16, 10, 0, i)).toISOString()));
    expect(() => new RecordedTelemetrySource(many)).toThrow(RangeError);
  });

  it.each([
    ['2026-10-16T10:00:00', 'missing zone'],
    ['2026-02-30T10:00:00Z', 'invalid calendar'],
    ['not a date', 'malformed'],
    ['2026-10-16T10:00:00+03:00', 'non-UTC'],
  ])('rejects %s (%s)', (timestamp) => {
    expect(() => new RecordedTelemetrySource([row(timestamp)])).toThrow(RangeError);
  });

  it('fails closed on duplicate timestamps and out-of-order data', () => {
    const first = row('2026-10-16T10:00:01Z');
    for (const second of [row('2026-10-16T10:00:01.000Z'), row('2026-10-16T10:00:00Z')]) {
      expect(() => new RecordedTelemetrySource([first, second])).toThrow('increase strictly');
    }
  });

  it.each(['temp', 'pressure', 'vibration'] as const)(
    'rejects missing, infinite, and NaN %s readings', (sensor) => {
      for (const bad of [NaN, Infinity, -Infinity, undefined]) {
        const badRow = row('2026-10-16T10:00:00Z');
        (badRow.metrics as unknown as Record<string, unknown>)[sensor] = bad;
        expect(() => new RecordedTelemetrySource([badRow])).toThrow(`Invalid recorded ${sensor}`);
      }
    },
  );

  it('keeps replay logic free from file, network and PLC control side effects', () => {
    const sample = new RecordedTelemetrySource([row('2026-10-16T10:00:00Z')]).next('normal');
    expect(sample.log_entry).toMatch(/Network traffic not measured/);
    expect(sample.traffic_volume).toBe(0);
    expect(sample.network_traffic).not.toMatch(/192\.168\.|203\.0\.113\./);
  });
});
