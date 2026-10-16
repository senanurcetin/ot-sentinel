import type { OfflineReplayManifest } from '@/lib/offline-replay-contract';
import type { Metrics } from '@/lib/types';
import { MAX_OFFLINE_TREND_SAMPLES } from '@/lib/offline-replay-trend-limit';

/**
 * Portable, browser-generated investigation notes. This is NOT forensic
 * attestation, plant provenance, ground-truth incident classification, or an
 * export of all recorded samples.
 */
export type OfflineReviewReport = {
  schema: 'ot-sentinel/local-reviewed-window/v1';
  generated_at_utc: string;
  evidence_scope: 'last-reviewed-samples-only';
  origin_authentication: 'NOT VERIFIED';
  detector: 'synthetic-three-sensor-demo';
  network_traffic: 'NOT RECORDED';
  recording: {
    sha256: string;
    manifest_checksum_matches_trusted_reference: true;
    source_label_unverified: string;
    first_utc: string;
    last_utc: string;
    total_recorded_rows: number;
    cadence_ms: number;
  };
  review: {
    inspected_rows_since_last_restart: number;
    exported_rows: number;
    window_limit: number;
    oldest_exported_utc: string;
    newest_exported_utc: string;
    critical_rows_in_export: number;
    nominal_rows_in_export: number;
    peak_demo_risk_in_export: number;
  };
  reviewed_samples: Array<{
    timestamp: string;
    temp: number;
    pressure: number;
    vibration: number;
    demo_risk_score: number;
    demo_verdict: Metrics['status'];
    sensor_contributions: Metrics['per_sensor_contributions'];
  }>;
};

const HASH = /^[a-f0-9]{64}$/;

export function buildOfflineReviewReport(
  manifest: OfflineReplayManifest,
  trustedSha256: string,
  inspectedRows: number,
  samples: readonly Metrics[],
  generatedAt: Date = new Date(),
): OfflineReviewReport {
  if (!HASH.test(trustedSha256) || trustedSha256 !== manifest.sha256) {
    throw new RangeError('Recording reference hash is unavailable or mismatched');
  }
  if (samples.length < 1 || samples.length > MAX_OFFLINE_TREND_SAMPLES ||
      !Number.isSafeInteger(inspectedRows) || inspectedRows < samples.length ||
      inspectedRows > manifest.row_count) {
    throw new RangeError('There are no valid reviewed samples to export');
  }
  if (!Number.isFinite(generatedAt.getTime())) {
    throw new RangeError('Invalid report generation time');
  }
  // Preserve source order and do not invent rows, interpolate gaps or export
  // the uninspected remainder of the original recording.
  let previous = -Infinity;
  const reviewed = samples.map((sample) => {
    const timestampMillis = Date.parse(sample.timestamp);
    if (!Number.isFinite(timestampMillis) || timestampMillis <= previous ||
        timestampMillis < Date.parse(manifest.start_utc) ||
        timestampMillis > Date.parse(manifest.end_utc) ||
        !Number.isFinite(sample.risk_score) || sample.risk_score < 0 ||
        sample.risk_score > 100 || !Number.isFinite(sample.metrics.temp) ||
        !Number.isFinite(sample.metrics.pressure) ||
        !Number.isFinite(sample.metrics.vibration) ||
        !['SECURE', 'CRITICAL'].includes(sample.status)) {
      throw new RangeError('Reviewed sample contains invalid recorded evidence');
    }
    previous = timestampMillis;
    return {
      timestamp: sample.timestamp,
      temp: sample.metrics.temp,
      pressure: sample.metrics.pressure,
      vibration: sample.metrics.vibration,
      demo_risk_score: sample.risk_score,
      demo_verdict: sample.status,
      sensor_contributions: sample.per_sensor_contributions.map((part) => ({ ...part })),
    };
  });
  const critical = reviewed.filter((row) => row.demo_verdict === 'CRITICAL').length;
  return {
    schema: 'ot-sentinel/local-reviewed-window/v1',
    generated_at_utc: generatedAt.toISOString(),
    evidence_scope: 'last-reviewed-samples-only',
    origin_authentication: 'NOT VERIFIED',
    detector: 'synthetic-three-sensor-demo',
    network_traffic: 'NOT RECORDED',
    recording: {
      sha256: trustedSha256,
      manifest_checksum_matches_trusted_reference: true,
      source_label_unverified: manifest.source_label,
      first_utc: manifest.start_utc,
      last_utc: manifest.end_utc,
      total_recorded_rows: manifest.row_count,
      cadence_ms: manifest.cadence_ms,
    },
    review: {
      inspected_rows_since_last_restart: inspectedRows,
      exported_rows: reviewed.length,
      window_limit: MAX_OFFLINE_TREND_SAMPLES,
      oldest_exported_utc: reviewed[0].timestamp,
      newest_exported_utc: reviewed[reviewed.length - 1].timestamp,
      critical_rows_in_export: critical,
      nominal_rows_in_export: reviewed.length - critical,
      peak_demo_risk_in_export: Math.max(...reviewed.map((row) => row.demo_risk_score)),
    },
    reviewed_samples: reviewed,
  };
}

/** JSON only: avoids spreadsheet formula execution and ambiguous CSV headers. */
export function serializeOfflineReviewReport(report: OfflineReviewReport): string {
  return JSON.stringify(report, null, 2) + '\n';
}
