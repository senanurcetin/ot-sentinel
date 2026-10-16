/** @jest-environment node */
import raw from '@/data/batadal-case-study/verified-hourly-dataset04.json';
import {
  HISTORICAL_SOURCE, historicalAttackPoints, historicalSignalOptions,
  signalGroup, signalUnit, validateHistoricalExport,
} from '@/lib/batadal-history';

const clone = () => JSON.parse(JSON.stringify(raw));

describe('published BATADAL 2016 hourly window contract', () => {
  it('validates the 2016 publisher SHA-256, 43 signal names and attack periods', () => {
    expect(validateHistoricalExport(raw)).toBeDefined();
    expect(HISTORICAL_SOURCE.provenance.source_sha256)
      .toBe('4746beab2cfcdb5e68c7fa197a7522aecb70189d61dcc3eb1f870d2ce387068b');
    expect(HISTORICAL_SOURCE.provenance.source_total_rows).toBe(4177);
    expect(HISTORICAL_SOURCE.feature_names).toHaveLength(43);
    expect(HISTORICAL_SOURCE.windows.map(w => w.rows.length))
      .toEqual([74, 48, 84, 118, 84, 118, 134]);
    expect(HISTORICAL_SOURCE.windows.reduce((n, w) => n + w.rows.length, 0)).toBe(660);
  });

  it('returns exact recorded values without interpolation and correct attack metadata', () => {
    const points = historicalAttackPoints(1, 'L_T1');
    expect(points).toHaveLength(74);
    expect(points[0]).toEqual({
      timestamp: '2016-09-13T11:00:00',
      value: 1.69,
      publishedAttackInterval: false,
    });
    expect(points.filter(p => p.publishedAttackInterval)).toHaveLength(50);
    expect(points[12].timestamp).toBe('2016-09-13T23:00:00');
    expect(points[12].publishedAttackInterval).toBe(true);
    expect(points[61].publishedAttackInterval).toBe(true);
    expect(points[62].publishedAttackInterval).toBe(false);
    expect(historicalAttackPoints(8, 'L_T1')).toEqual([]);
    expect(historicalAttackPoints(1, 'fake_sensor')).toEqual([]);
  });

  it('groups all 43 actual sensors and keeps physical dimensions distinct', () => {
    const categories = ['levels', 'flows', 'states', 'pressures'] as const;
    const combined = categories.flatMap(cat => historicalSignalOptions(cat));
    expect(combined).toHaveLength(43);
    expect(new Set(combined).size).toBe(43);
    for (const cat of categories) {
      expect(historicalSignalOptions(cat).every(code => signalGroup(code) === cat)).toBe(true);
    }
    expect(signalUnit('F_PU3')).toBe('LPS');
    expect(signalUnit('P_J280')).toBe('m');
    expect(signalUnit('L_T3')).toBe('m');
    expect(signalUnit('S_PU7')).toBe('on/off');
    expect(() => signalUnit('SIMULATED_TEMP')).toThrow();
  });

  it('rejects wrong source hash, feature order, missing values and fake interval duration', () => {
    const wrongHash = clone();
    wrongHash.provenance.source_sha256 = '0'.repeat(64);
    expect(() => validateHistoricalExport(wrongHash)).toThrow();

    const reordered = clone();
    [reordered.feature_names[0], reordered.feature_names[1]] =
      [reordered.feature_names[1], reordered.feature_names[0]];
    expect(() => validateHistoricalExport(reordered)).toThrow(/inventory/);

    const nan = clone();
    nan.windows[0].rows[0].values[0] = null;
    expect(() => validateHistoricalExport(nan)).toThrow();

    const inflated = clone();
    inflated.attack_intervals[0].duration_hours++;
    expect(() => validateHistoricalExport(inflated)).toThrow(/chronology/);
  });

  it('rejects missing/duplicated/out-of-order hours and mismatched published attack ids', () => {
    const gap = clone();
    gap.windows[0].rows[2].timestamp = gap.windows[0].rows[3].timestamp;
    expect(() => validateHistoricalExport(gap)).toThrow(/chronology/);

    const tampered = clone();
    tampered.windows[0].attack_id = 7;
    expect(() => validateHistoricalExport(tampered)).toThrow(/chronology/);

    const foreignTime = clone();
    foreignTime.windows[0].rows[0].timestamp = '2026-09-13T11:00:00';
    expect(() => validateHistoricalExport(foreignTime)).toThrow();

    const extra = clone();
    extra.windows[0].rows.push(extra.windows[0].rows.at(-1));
    expect(() => validateHistoricalExport(extra)).toThrow(/chronology/);
  });
});
