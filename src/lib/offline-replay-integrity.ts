import { createHash } from 'node:crypto';
import {
  MAX_REPLAY_ROWS,
  RecordedTelemetrySource,
  type RecordedThreeSensorRow,
} from '@/lib/recorded-telemetry';

/**
 * Offline-only integrity gate for a three-sensor recording. A matching checksum
 * proves byte equality with the trusted reference, not authenticity of a plant.
 * This module does not open files, connect to a network or expose an API route.
 */
export type OfflineReplayManifest = {
  schema: 'ot-sentinel/offline-three-sensor/v1';
  /** Informational only: this label is not authenticated sensor identity. */
  source_label: string;
  /** SHA-256 of the exact original UTF-8 JSON bytes, hex encoded. */
  sha256: string;
  row_count: number;
  start_utc: string;
  end_utc: string;
  /** Require an exact timestamp interval: gaps and duplicates fail closed. */
  cadence_ms: number;
};

export const MAX_OFFLINE_REPLAY_BYTES = 2 * 1024 * 1024;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SCHEMA = 'ot-sentinel/offline-three-sensor/v1';
const MANIFEST_FIELDS = [
  'schema', 'source_label', 'sha256', 'row_count',
  'start_utc', 'end_utc', 'cadence_ms',
] as const;

function validateManifest(value: unknown): asserts value is OfflineReplayManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError('Invalid offline replay manifest');
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== MANIFEST_FIELDS.length ||
      keys.some((key) => !MANIFEST_FIELDS.includes(key as typeof MANIFEST_FIELDS[number])) ||
      obj.schema !== SCHEMA ||
      typeof obj.sha256 !== 'string' || !SHA256_HEX.test(obj.sha256) ||
      typeof obj.source_label !== 'string' ||
      !obj.source_label.trim() || obj.source_label.length > 120 ||
      typeof obj.start_utc !== 'string' || typeof obj.end_utc !== 'string' ||
      !Number.isSafeInteger(obj.row_count) ||
      (obj.row_count as number) < 1 || (obj.row_count as number) > MAX_REPLAY_ROWS ||
      !Number.isSafeInteger(obj.cadence_ms) ||
      (obj.cadence_ms as number) < 1 || (obj.cadence_ms as number) > 86_400_000) {
    throw new RangeError('Invalid offline replay manifest');
  }
}

/**
 * Load raw JSON bytes only when BOTH the manifest and an independently supplied
 * trusted checksum agree with the bytes. Never derive trustedSha256 from the
 * untrusted file/manifest itself.
 *
 * RecordedTelemetrySource performs strict sensor, UTC, order and finite checks.
 * This gate additionally verifies raw-byte integrity, count, range and cadence.
 */
export function loadVerifiedOfflineReplay(
  raw: Uint8Array,
  manifest: unknown,
  trustedSha256: string
): RecordedTelemetrySource {
  if (!(raw instanceof Uint8Array) ||
      raw.byteLength === 0 || raw.byteLength > MAX_OFFLINE_REPLAY_BYTES) {
    throw new RangeError('Invalid offline replay byte length');
  }
  validateManifest(manifest);
  if (!SHA256_HEX.test(trustedSha256)) {
    throw new RangeError('An independently trusted SHA-256 is required');
  }

  const digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== trustedSha256 || digest !== manifest.sha256) {
    throw new RangeError('Offline replay checksum mismatch');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch {
    throw new RangeError('Offline replay must be valid UTF-8 JSON');
  }
  if (!Array.isArray(parsed) || parsed.length !== manifest.row_count) {
    throw new RangeError('Offline replay row count mismatch');
  }

  // Constructor validates the complete strict three-sensor contract before we
  // inspect timestamps; the asserted type is not a substitute for validation.
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
