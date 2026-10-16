import {
  validateReplayEnvelope, assertReplayDigest, parseVerifiedReplayBytes,
} from '@/lib/offline-replay-contract';
import type { RecordedTelemetrySource } from '@/lib/recorded-telemetry';

/**
 * Browser-only local verification. Caller selects local files; no data leaves
 * the browser and no Next.js API or Gemini request is made.
 */
export async function loadVerifiedOfflineReplayInBrowser(
  raw: Uint8Array, manifest: unknown, trustedSha256: string
): Promise<RecordedTelemetrySource> {
  const checked = validateReplayEnvelope(raw, manifest, trustedSha256);
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Local SHA-256 verification requires HTTPS or localhost');
  }
  // Copy into an ArrayBuffer-backed view for the Web Crypto BufferSource type.
  const copy = new Uint8Array(raw.length);
  copy.set(raw);
  const digestBuffer = await crypto.subtle.digest('SHA-256', copy);
  const hex = Array.from(new Uint8Array(digestBuffer))
    .map((value) => value.toString(16).padStart(2, '0')).join('');
  assertReplayDigest(hex, checked, trustedSha256);
  return parseVerifiedReplayBytes(raw, checked);
}
