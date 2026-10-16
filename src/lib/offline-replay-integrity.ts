import { createHash } from 'node:crypto';
import {
  validateReplayEnvelope, assertReplayDigest, parseVerifiedReplayBytes,
} from '@/lib/offline-replay-contract';
import type { RecordedTelemetrySource } from '@/lib/recorded-telemetry';

export type { OfflineReplayManifest } from '@/lib/offline-replay-contract';
export { MAX_OFFLINE_REPLAY_BYTES } from '@/lib/offline-replay-contract';

/**
 * Offline Node verifier. An independently trusted digest proves exact byte
 * agreement, not authenticity of a physical plant or security certification.
 */
export function loadVerifiedOfflineReplay(
  raw: Uint8Array, manifest: unknown, trustedSha256: string
): RecordedTelemetrySource {
  const checked = validateReplayEnvelope(raw, manifest, trustedSha256);
  const digest = createHash('sha256').update(raw).digest('hex');
  assertReplayDigest(digest, checked, trustedSha256);
  return parseVerifiedReplayBytes(raw, checked);
}
