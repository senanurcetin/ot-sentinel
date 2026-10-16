/** @jest-environment node */
import { createHash, webcrypto } from 'node:crypto';
import { loadVerifiedOfflineReplayInBrowser } from '@/lib/offline-replay-browser';

const rows = [
  { timestamp: '2026-10-16T10:00:00Z', metrics: { temp: 50, pressure: 1010, vibration: 0.055 } },
  { timestamp: '2026-10-16T10:00:01Z', metrics: { temp: 130, pressure: 1010, vibration: 0.055 } },
];

function fixture(data: unknown = rows) {
  const raw = Buffer.from(JSON.stringify(data));
  const checksum = createHash('sha256').update(raw).digest('hex');
  return {
    raw,
    checksum,
    manifest: {
      schema: 'ot-sentinel/offline-three-sensor/v1',
      source_label: 'offline-test',
      sha256: checksum,
      row_count: 2,
      start_utc: '2026-10-16T10:00:00Z',
      end_utc: '2026-10-16T10:00:01Z',
      cadence_ms: 1000,
    },
  };
}

describe('browser offline replay verifier', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  });

  it('matches the Node digest contract and returns exactly the recorded samples', async () => {
    const { raw, manifest, checksum } = fixture();
    const replay = await loadVerifiedOfflineReplayInBrowser(raw, manifest, checksum);
    expect(replay.next('attack').metrics.temp).toBe(50);
    expect(replay.next('normal').status).toBe('CRITICAL');
    expect(() => replay.next('normal')).toThrow('exhausted');
  });

  it('fails closed if an independently supplied digest disagrees', async () => {
    const { raw, manifest } = fixture();
    await expect(loadVerifiedOfflineReplayInBrowser(raw, manifest, 'a'.repeat(64)))
      .rejects.toThrow('checksum mismatch');
  });

  it('rejects timestamp gaps even when the local checksum matches', async () => {
    const shifted = fixture([rows[0], { ...rows[1], timestamp: '2026-10-16T10:00:03Z' }]);
    await expect(loadVerifiedOfflineReplayInBrowser(
      shifted.raw, { ...shifted.manifest, end_utc: '2026-10-16T10:00:03Z' }, shifted.checksum
    )).rejects.toThrow('irregular timestamp');
  });

  it('requires HTTPS/localhost Web Crypto; does not silently skip hashing', async () => {
    const { raw, manifest, checksum } = fixture();
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      await expect(loadVerifiedOfflineReplayInBrowser(raw, manifest, checksum))
        .rejects.toThrow('HTTPS or localhost');
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});
