import { RecordedTelemetrySource } from '@/lib/recorded-telemetry';
import { buildOfflineReviewReport, serializeOfflineReviewReport } from '@/lib/offline-replay-report';
import type { OfflineReplayManifest } from '@/lib/offline-replay-contract';
import type { Metrics } from '@/lib/types';

const DIGEST = 'b9d39cd41d9358d143432876db77de7ac70e315d9dc4ac1ee4972f34160b2936';
const manifest: OfflineReplayManifest = {
  schema: 'ot-sentinel/offline-three-sensor/v1',
  source_label: 'SYNTHETIC <sample> =HYPERLINK("https://example.test")',
  sha256: DIGEST,
  row_count: 5,
  start_utc: '2026-10-16T10:00:00Z',
  end_utc: '2026-10-16T10:00:04Z',
  cadence_ms: 1000,
};

function reviewedSamples(): Metrics[] {
  const source = new RecordedTelemetrySource([
    { timestamp: '2026-10-16T10:00:03Z', metrics: { temp: 50, pressure: 1010, vibration: 0.055 } },
    { timestamp: '2026-10-16T10:00:04Z', metrics: { temp: 130, pressure: 1010, vibration: 0.055 } },
  ]);
  return [source.next('attack'), source.next('normal')];
}

describe('local offline review evidence export', () => {
  it('exports only reviewed window, clearly labels unverified origin and demo scoring', () => {
    const samples = reviewedSamples();
    const generatedAt = new Date('2026-10-16T12:00:00.000Z');
    const report = buildOfflineReviewReport(manifest, DIGEST, 5, samples, generatedAt);
    expect(report).toMatchObject({
      schema: 'ot-sentinel/local-reviewed-window/v1',
      generated_at_utc: '2026-10-16T12:00:00.000Z',
      evidence_scope: 'last-reviewed-samples-only',
      origin_authentication: 'NOT VERIFIED',
      detector: 'synthetic-three-sensor-demo',
      network_traffic: 'NOT RECORDED',
      recording: { sha256: DIGEST, total_recorded_rows: 5, source_label_unverified: manifest.source_label },
      review: {
        inspected_rows_since_last_restart: 5,
        exported_rows: 2,
        window_limit: 120,
        oldest_exported_utc: samples[0].timestamp,
        newest_exported_utc: samples[1].timestamp,
        critical_rows_in_export: 1,
        nominal_rows_in_export: 1,
      },
    });
    expect(report.reviewed_samples).toHaveLength(2);
    expect(report.reviewed_samples[1].demo_verdict).toBe('CRITICAL');
    expect(report.reviewed_samples[0].sensor_contributions).toHaveLength(3);
    expect(report.review.peak_demo_risk_in_export).toBe(Math.max(...samples.map(s => s.risk_score)));
    expect(report.reviewed_samples[0]).not.toHaveProperty('traffic_volume');
    expect(report.reviewed_samples[0]).not.toHaveProperty('network_traffic');
    expect(JSON.parse(serializeOfflineReviewReport(report))).toEqual(report);
    expect(serializeOfflineReviewReport(report)).toContain('=HYPERLINK');
  });

  it('does not permit export without reviewed rows or independently pinned checksum', () => {
    const samples = reviewedSamples();
    expect(() => buildOfflineReviewReport(manifest, DIGEST, 0, []))
      .toThrow('no valid reviewed samples');
    expect(() => buildOfflineReviewReport(manifest, '', 2, samples))
      .toThrow('reference hash');
    expect(() => buildOfflineReviewReport(manifest, 'a'.repeat(64), 2, samples))
      .toThrow('reference hash');
    expect(() => buildOfflineReviewReport(manifest, DIGEST, 1, samples))
      .toThrow('no valid reviewed samples');
    expect(() => buildOfflineReviewReport(manifest, DIGEST, 6, samples))
      .toThrow('no valid reviewed samples');
  });

  it('rejects altered, out-of-order, nonfinite and out-of-range review entries', () => {
    const samples = reviewedSamples();
    expect(() => buildOfflineReviewReport(manifest, DIGEST, 2, [samples[1], samples[0]]))
      .toThrow('invalid recorded evidence');
    expect(() => buildOfflineReviewReport(manifest, DIGEST, 2,
      [{ ...samples[0], risk_score: Number.NaN }, samples[1]]
    )).toThrow('invalid recorded evidence');
    expect(() => buildOfflineReviewReport(manifest, DIGEST, 2,
      [{ ...samples[0], timestamp: '2027-01-01T00:00:00Z' }, samples[1]]
    )).toThrow('invalid recorded evidence');
    expect(() => buildOfflineReviewReport(manifest, DIGEST, 2,
      [{ ...samples[0], metrics: { ...samples[0].metrics, temp: Infinity } }, samples[1]]
    )).toThrow('invalid recorded evidence');
    expect(() => buildOfflineReviewReport(manifest, DIGEST, 2, samples, new Date(Number.NaN)))
      .toThrow('Invalid report generation time');
  });

  it('keeps a snapshot of copied contribution data rather than retaining caller objects', () => {
    const samples = reviewedSamples();
    const report = buildOfflineReviewReport(manifest, DIGEST, 2, samples);
    const original = report.reviewed_samples[0].sensor_contributions[0].z_score;
    samples[0].per_sensor_contributions[0].z_score = 777;
    expect(report.reviewed_samples[0].sensor_contributions[0].z_score).toBe(original);
  });
});
