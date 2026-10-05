/** @jest-environment node */
import { syntheticSource } from '@/lib/telemetry-source';
import type { Metrics } from '@/lib/types';

/** Deterministic PRNG (mulberry32) so statistical assertions cannot flake. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

afterEach(() => jest.restoreAllMocks());

describe('syntheticSource', () => {
  it('normal mode almost never raises a false CRITICAL alarm', async () => {
    jest.spyOn(Math, 'random').mockImplementation(seeded(42));
    const N = 20_000;
    let critical = 0;
    for (let i = 0; i < N; i++) if ((await syntheticSource.next('normal')).status === 'CRITICAL') critical++;
    // The previous uniform generator produced ~0.37% (about 1 per 4.5 minutes at 1 Hz).
    expect(critical / N).toBeLessThan(0.0005);
  });

  it('normal readings centre on the detector baseline', async () => {
    jest.spyOn(Math, 'random').mockImplementation(seeded(7));
    const samples: Metrics['metrics'][] = [];
    for (let i = 0; i < 5000; i++) samples.push((await syntheticSource.next('normal')).metrics);
    const mean = (f: (m: Metrics['metrics']) => number) =>
      samples.reduce((sum, m) => sum + f(m), 0) / samples.length;
    expect(mean((m) => m.temp)).toBeCloseTo(50, 0);
    expect(mean((m) => m.pressure)).toBeCloseTo(1010, 0);
    expect(mean((m) => m.vibration)).toBeCloseTo(0.055, 2);
  });

  it('keeps vibration readings finer than the baseline std (3 decimals)', async () => {
    jest.spyOn(Math, 'random').mockImplementation(seeded(3));
    const values = new Set<number>();
    for (let i = 0; i < 500; i++) values.add((await syntheticSource.next('normal')).metrics.vibration);
    expect(values.size).toBeGreaterThan(20); // at 2 decimals only ~10 distinct values exist
  });

  it('attack mode always crosses the CRITICAL line', async () => {
    jest.spyOn(Math, 'random').mockImplementation(seeded(11));
    for (let i = 0; i < 2000; i++) {
      const sample = await syntheticSource.next('attack');
      expect(sample.status).toBe('CRITICAL');
      expect(sample.risk_score).toBeGreaterThanOrEqual(50);
    }
  });

  it('tags attack traffic with external addresses and normal traffic with internal ones', async () => {
    const normal = await syntheticSource.next('normal');
    const attack = await syntheticSource.next('attack');
    expect(normal.network_traffic).toMatch(/^(192\.168\.|10\.)/);
    expect(attack.network_traffic).not.toMatch(/^(192\.168\.|10\.)/);
  });
});
