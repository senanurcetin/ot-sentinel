/** @jest-environment node */
import raw from '@/data/batadal-case-study/results.json';
import { results } from '@/lib/case-study';
import {
  BATADAL_GROUPS, BATADAL_PROVENANCE, attackEvidence,
  benchmarkDetectorOptions, detectorOverview, featureGroup, signalInventory,
} from '@/lib/batadal-explorer';

describe('BATADAL benchmark evidence inventory', () => {
  it('uses exactly the 43 published feature codes, never the three-sensor demo', () => {
    const all = signalInventory('test');
    expect(BATADAL_PROVENANCE.signals).toBe(43);
    expect(all).toHaveLength(43);
    expect(all.map(x => x.code)).toEqual(raw.data.features);
    expect(new Set(all.map(x => x.code)).size).toBe(43);
    expect(all.filter(x => x.constantReference).map(x => x.code))
      .toEqual(raw.data.constant_features_in_reference);
    expect(BATADAL_PROVENANCE.fullRecordedTracesIncluded).toBe(false);
  });

  it('partitions feature classes without dropping pump, valve, tank or junction signals', () => {
    const codes = new Set<string>();
    for (const group of BATADAL_GROUPS.filter(x => x.id !== 'all')) {
      const members = signalInventory('test', group.id);
      expect(members.length).toBeGreaterThan(0);
      members.forEach(x => {
        expect(featureGroup(x.code)).toBe(group.id);
        expect(codes.has(x.code)).toBe(false);
        codes.add(x.code);
      });
    }
    expect(codes.size).toBe(43);
    expect(() => featureGroup('FAKE_MEASURED_PLC')).toThrow();
  });

  it('labels missing drift observations as null, not as 0% or healthy', () => {
    const all = signalInventory('test');
    const junction = all.find(x => x.code === 'P_J280')!;
    expect(junction.reportedTopDriftFraction)
      .toBe(raw.drift.test.top_features_share_of_hours_outside_reference_range.P_J280);
    const unreported = all.find(x => x.code === 'S_PU8')!;
    expect(unreported.reportedTopDriftFraction).toBeNull();
    expect(signalInventory('train').find(x => x.code === 'P_J280')!.reportedTopDriftFraction)
      .toBe(raw.drift.train.top_features_share_of_hours_outside_reference_range.P_J280);
  });

  it('separates seven unseen attacks from seven secondary attacks', () => {
    const test = attackEvidence('test', 'zscore_max');
    const train = attackEvidence('train', 'zscore_max');
    expect(test.map(x => x.id)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(train.map(x => x.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const row of [...test, ...train]) {
      expect(row.descriptionAffectedSignals).toEqual(raw.affected_signals[String(row.id) as keyof typeof raw.affected_signals]);
      expect(row.durationHours).toBeGreaterThan(0);
      expect(row.detectionDelayHours === null || row.detectionDelayHours >= 0).toBe(true);
    }
  });

  it('never advertises training-set evaluation of the supervised model', () => {
    expect(benchmarkDetectorOptions('test').map(x => x.id)).toContain('hist_gradient_boosting');
    expect(benchmarkDetectorOptions('train').map(x => x.id)).not.toContain('hist_gradient_boosting');
    expect(attackEvidence('train', 'hist_gradient_boosting')).toEqual([]);
    expect(detectorOverview(results.evaluations.train, 'hist_gradient_boosting')).toBeNull();
  });

  it('derives detector metrics from committed evaluation results without new inference', () => {
    const d = results.evaluations.test.detectors.zscore_max;
    const overview = detectorOverview(results.evaluations.test, 'zscore_max')!;
    expect(overview.prAuc).toBe(d.point.pr_auc);
    expect(overview.falseAlarmHourFraction).toBe(d.event.false_alarm_hour_fraction);
    expect(overview.expectedEventsByChance).toBe(d.event.expected_events_detected_by_chance);
    expect(overview.supervised).toBe(false);
    expect(attackEvidence('test', 'zscore_max')[0].detectionDelayHours)
      .toBe(d.per_attack[0].hours_to_detect);
  });
});
