/** @jest-environment node */
import { createHash } from 'node:crypto';
import {
  loadVerifiedOfflineReplay,
  MAX_OFFLINE_REPLAY_BYTES,
  type OfflineReplayManifest,
} from '@/lib/offline-replay-integrity';

const rows = [
  { timestamp: '2026-10-16T10:00:00Z', metrics: { temp: 50, pressure: 1010, vibration: 0.055 } },
  { timestamp: '2026-10-16T10:00:01Z', metrics: { temp: 130, pressure: 1010, vibration: 0.055 } },
];

function fixture(sampleRows: unknown = rows) {
  const raw = Buffer.from(JSON.stringify(sampleRows), 'utf8');
  const trustedSha256 = createHash('sha256').update(raw).digest('hex');
  const manifest: OfflineReplayManifest = {
    schema: 'ot-sentinel/offline-three-sensor/v1',
    source_label: 'local-test-recording (not plant data)',
    sha256: trustedSha256,
    row_count: rows.length,
    start_utc: rows[0].timestamp,
    end_utc: rows[1].timestamp,
    cadence_ms: 1000,
  };
  return { raw, manifest, trustedSha256 };
}

describe('offline replay integrity gate', () => {
  it('accepts exact bytes, a separate trust anchor, strict cadence and deterministic EOF', () => {
    const { raw, manifest, trustedSha256 } = fixture();
    const recording = loadVerifiedOfflineReplay(raw, manifest, trustedSha256);
    expect(recording.next('attack').metrics.temp).toBe(50);
    const alert = recording.next('normal');
    expect(alert.timestamp).toBe(rows[1].timestamp);
    expect(alert.status).toBe('CRITICAL');
    expect(() => recording.next('normal')).toThrow('exhausted');
  });

  it('rejects tampering even if the untrusted manifest is updated to match modified bytes', () => {
    const good = fixture();
    const changed = fixture([
      rows[0], { ...rows[1], metrics: { ...rows[1].metrics, temp: 150 } },
    ]);
    expect(() => loadVerifiedOfflineReplay(changed.raw, good.manifest, good.trustedSha256))
      .toThrow('checksum mismatch');
    expect(() => loadVerifiedOfflineReplay(changed.raw, changed.manifest, good.trustedSha256))
      .toThrow('checksum mismatch');
  });

  it('rejects multiline or bidirectional source labels that could misrepresent provenance', () => {
    const { raw, manifest, trustedSha256 } = fixture();
    for (const source_label of [
      'simulated\\nVERIFIED PLANT',
      'fake\\tproduction',
      'PLC\\u202e-NOT-VERIFIED',
      'PLC\\u2066OTHER\\u2069',
      'PLC\\u0000plant',
    ]) {
      expect(() => loadVerifiedOfflineReplay(raw, { ...manifest, source_label }, trustedSha256))
        .toThrow('Invalid offline replay manifest');
    }
    expect(loadVerifiedOfflineReplay(raw, manifest, trustedSha256).next('normal').metrics.temp).toBe(50);
  });

  it('rejects missing trust anchors and unsupported manifest keys', () => {
    const { raw, manifest, trustedSha256 } = fixture();
    expect(() => loadVerifiedOfflineReplay(raw, manifest, '')).toThrow('independently trusted');
    expect(() => loadVerifiedOfflineReplay(raw, { ...manifest, device: 'PLC-01' }, trustedSha256))
      .toThrow('Invalid offline replay manifest');
    expect(() => loadVerifiedOfflineReplay(raw, { ...manifest, schema: 'v2' }, trustedSha256))
      .toThrow('Invalid offline replay manifest');
  });

  it('detects an incorrect count and timestamp range, even when hashes agree', () => {
    const { raw, manifest, trustedSha256 } = fixture();
    expect(() => loadVerifiedOfflineReplay(raw, { ...manifest, row_count: 1 }, trustedSha256))
      .toThrow('row count');
    expect(() => loadVerifiedOfflineReplay(raw, { ...manifest, end_utc: rows[0].timestamp }, trustedSha256))
      .toThrow('timestamp range');
  });

  it('rejects missing intervals, duplicate timestamps and unsupported sensor fields', () => {
    const gaps = fixture([
      rows[0], { ...rows[1], timestamp: '2026-10-16T10:00:03Z' },
    ]);
    expect(() => loadVerifiedOfflineReplay(
      gaps.raw, { ...gaps.manifest, end_utc: '2026-10-16T10:00:03Z' },
      gaps.trustedSha256
    )).toThrow('irregular timestamp');

    const duplicates = fixture([rows[0], { ...rows[1], timestamp: rows[0].timestamp }]);
    expect(() => loadVerifiedOfflineReplay(duplicates.raw, duplicates.manifest, duplicates.trustedSha256))
      .toThrow('increase strictly');

    const extra = fixture([{ ...rows[0], metrics: { ...rows[0].metrics, flow: 2 } }, rows[1]]);
    expect(() => loadVerifiedOfflineReplay(extra.raw, extra.manifest, extra.trustedSha256))
      .toThrow('exactly temp');
  });

  it('rejects invalid JSON, invalid UTF-8, non-array root and out-of-bounds bytes', () => {
    for (const raw of [
      Buffer.from('not-json', 'utf8'),
      Uint8Array.of(0xff, 0xfe, 0xfd),
      Buffer.from('{"rows":[]}', 'utf8'),
    ]) {
      const digest = createHash('sha256').update(raw).digest('hex');
      const manifest = { ...fixture().manifest, sha256: digest };
      expect(() => loadVerifiedOfflineReplay(raw, manifest, digest)).toThrow(RangeError);
    }
    const { manifest, trustedSha256 } = fixture();
    expect(() => loadVerifiedOfflineReplay(new Uint8Array(), manifest, trustedSha256))
      .toThrow('byte length');
    expect(() => loadVerifiedOfflineReplay(
      new Uint8Array(MAX_OFFLINE_REPLAY_BYTES + 1), manifest, trustedSha256
    )).toThrow('byte length');
  });
});
