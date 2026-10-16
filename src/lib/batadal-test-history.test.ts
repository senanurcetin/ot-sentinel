/** @jest-environment node */
import raw from '@/data/batadal-case-study/verified-hourly-test.json';
import {
 HISTORICAL_TEST_SOURCE, HISTORICAL_SOURCE, getHistoricalSource,
 historicalAttackPoints, validateHistoricalExport,
} from '@/lib/batadal-history';

const clone = () => JSON.parse(JSON.stringify(raw));

describe('publisher-verified 2017 BATADAL test ZIP source evidence', () => {
 it('exposes genuine unlabelled 2017 holdout only under its own dataset identity', () => {
  expect(validateHistoricalExport(raw, 'test')).toBeDefined();
  expect(HISTORICAL_TEST_SOURCE.provenance.source_sha256)
    .toBe('27e4a15eca583fca8bf133360866189f50af982899ad18b66dff70fb78d1a6fa');
  expect(HISTORICAL_TEST_SOURCE.feature_names).toEqual(HISTORICAL_SOURCE.feature_names);
  expect(HISTORICAL_TEST_SOURCE.provenance.source_total_rows).toBe(2089);
  expect(HISTORICAL_TEST_SOURCE.windows.map(w => w.rows.length))
    .toEqual([94, 89, 55, 55, 124, 104, 54]);
  expect(HISTORICAL_TEST_SOURCE.windows.reduce((total,w) => total+w.rows.length,0)).toBe(575);
  expect(HISTORICAL_TEST_SOURCE.attack_intervals.map(x => x.id)).toEqual([8,9,10,11,12,13,14]);
  expect(getHistoricalSource('test')).toBe(HISTORICAL_TEST_SOURCE);
  expect(getHistoricalSource()).toBe(HISTORICAL_SOURCE);
 });
 it('never interpolates, labels inferred detections, or mixes 2016 and 2017 windows', () => {
  expect(historicalAttackPoints(1, 'L_T3', 'test')).toEqual([]);
  expect(historicalAttackPoints(8, 'L_T3')).toEqual([]);
  expect(historicalAttackPoints(8, 'UNKNOWN', 'test')).toEqual([]);
  for (const window of HISTORICAL_TEST_SOURCE.windows) {
   const points = historicalAttackPoints(window.attack_id, 'L_T3', 'test');
   expect(points).toHaveLength(window.rows.length);
   expect(points.map(x=>x.value)).toEqual(window.rows.map(x=>x.values[2]));
   expect(points.filter(x=>x.publishedAttackInterval)).toHaveLength(
    HISTORICAL_TEST_SOURCE.attack_intervals.find(x=>x.id===window.attack_id)!.duration_hours
   );
   expect(points[0].publishedAttackInterval).toBe(false);
   expect(points.at(-1)?.publishedAttackInterval).toBe(false);
  }
 });
 it('rejects wrong source, shuffled features, duplicate hours and malformed attack metadata', () => {
  const wrong = clone(); wrong.provenance.source_sha256 = '0'.repeat(64);
  expect(()=>validateHistoricalExport(wrong,'test')).toThrow(/mismatch/);
  expect(()=>validateHistoricalExport(raw,'dataset04')).toThrow(/mismatch/);
  const swapped = clone();
  [swapped.feature_names[0],swapped.feature_names[1]] = [swapped.feature_names[1],swapped.feature_names[0]];
  expect(()=>validateHistoricalExport(swapped,'test')).toThrow(/inventory/);
  const gap = clone();
  gap.windows[0].rows[1].timestamp=gap.windows[0].rows[0].timestamp;
  expect(()=>validateHistoricalExport(gap,'test')).toThrow(/chronology/);
  const forged = clone(); forged.attack_intervals[0].duration_hours++;
  expect(()=>validateHistoricalExport(forged,'test')).toThrow(/chronology/);
 });
});
