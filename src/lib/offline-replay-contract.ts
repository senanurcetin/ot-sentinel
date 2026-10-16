import {
  MAX_REPLAY_ROWS,
  RecordedTelemetrySource,
  type RecordedThreeSensorRow,
} from '@/lib/recorded-telemetry';

/** Browser-safe validation shared by the Node verifier and local file viewer. */
export type OfflineReplayManifest = {
  schema: 'ot-sentinel/offline-three-sensor/v1';
  /** Informational label only, never verified physical sensor identity. */
  source_label: string;
  sha256: string;
  row_count: number;
  start_utc: string;
  end_utc: string;
  cadence_ms: number;
};

export const MAX_OFFLINE_REPLAY_BYTES = 2 * 1024 * 1024;
export const MAX_OFFLINE_MANIFEST_BYTES = 16 * 1024;
const SHA256_HEX = /^[a-f0-9]{64}$/;
// Control, direction-override and isolate characters can spoof displayed provenance.
const UNSAFE_SOURCE_LABEL = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const SCHEMA = 'ot-sentinel/offline-three-sensor/v1';
const FIELDS = [
  'schema', 'source_label', 'sha256', 'row_count',
  'start_utc', 'end_utc', 'cadence_ms',
] as const;

function validateManifest(value: unknown): asserts value is OfflineReplayManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError('Invalid offline replay manifest');
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== FIELDS.length ||
      keys.some((key) => !FIELDS.includes(key as typeof FIELDS[number])) ||
      obj.schema !== SCHEMA ||
      typeof obj.sha256 !== 'string' || !SHA256_HEX.test(obj.sha256) ||
      typeof obj.source_label !== 'string' ||
      !obj.source_label.trim() || obj.source_label.length > 120 ||
      UNSAFE_SOURCE_LABEL.test(obj.source_label) ||
      typeof obj.start_utc !== 'string' || typeof obj.end_utc !== 'string' ||
      !Number.isSafeInteger(obj.row_count) ||
      (obj.row_count as number) < 1 || (obj.row_count as number) > MAX_REPLAY_ROWS ||
      !Number.isSafeInteger(obj.cadence_ms) ||
      (obj.cadence_ms as number) < 1 || (obj.cadence_ms as number) > 86_400_000) {
    throw new RangeError('Invalid offline replay manifest');
  }
}

/** Reject unbounded recording size or untrusted/incomplete manifest metadata. */
export function validateReplayEnvelope(
  raw: Uint8Array, manifest: unknown, independentlyTrustedSha256: string
): OfflineReplayManifest {
  if (!(raw instanceof Uint8Array) ||
      raw.byteLength === 0 || raw.byteLength > MAX_OFFLINE_REPLAY_BYTES) {
    throw new RangeError('Invalid offline replay byte length');
  }
  validateManifest(manifest);
  if (!SHA256_HEX.test(independentlyTrustedSha256)) {
    throw new RangeError('An independently trusted SHA-256 is required');
  }
  return manifest;
}

/** A digest supplied in the same untrusted manifest is NOT a trust anchor. */
export function assertReplayDigest(
  actual: string, manifest: OfflineReplayManifest, independentlyTrustedSha256: string
): void {
  if (actual !== independentlyTrustedSha256 || actual !== manifest.sha256) {
    throw new RangeError('Offline replay checksum mismatch');
  }
}

/** Called only AFTER the recording hash has been verified. No file/network I/O. */
export function parseVerifiedReplayBytes(
  raw: Uint8Array, manifest: OfflineReplayManifest
): RecordedTelemetrySource {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch {
    throw new RangeError('Offline replay must be valid UTF-8 JSON');
  }
  if (!Array.isArray(parsed) || parsed.length !== manifest.row_count) {
    throw new RangeError('Offline replay row count mismatch');
  }

  // Constructor performs strict sensor, timestamp and finite-number checks.
  const rows = parsed as RecordedThreeSensorRow[];
  const replay = new RecordedTelemetrySource(rows);
  if (rows[0].timestamp !== manifest.start_utc ||
      rows[rows.length - 1].timestamp !== manifest.end_utc) {
    throw new RangeError('Offline replay timestamp range mismatch');
  }
  for (let i = 1; i < rows.length; i++) {
    if (Date.parse(rows[i].timestamp) - Date.parse(rows[i - 1].timestamp) !== manifest.cadence_ms) {
      throw new RangeError('Offline replay has missing or irregular timestamp intervals');
    }
  }
  return replay;
}
