/** @jest-environment node */
import {
  HISTORICAL_TEST_SOURCE, HISTORICAL_SOURCE,
  historicalDetectorOptions, historicalDetectorEvidence,
} from '@/lib/batadal-history';
import { results } from '@/lib/case-study';

describe('retrospective published BATADAL detector context', () => {
  it('reports first alarm from published 2017 holdout metrics without scoring history', () => {
    const event = historicalDetectorEvidence('test', 8, 'zscore_max');
    expect(event).not.toBeNull();
    expect(event).toMatchObject({
      attackId: 8,
      detectorKey: 'zscore_max',
      detected: true,
      firstAlarmDelayHours: 11,
    });
    const started = HISTORICAL_TEST_SOURCE.attack_intervals[0].start;
    expect(event!.firstAlarmSourceLocal).toBe(
      new Date(Date.parse(started + 'Z') + 11 * 3_600_000).toISOString().slice(0, 19)
    );
    expect(event!.falseAlarmsPerDay)
      .toBe(results.evaluations.test.detectors.zscore_max.event.false_alarms_per_day);
    expect(event!.expectedEventsFromFalseAlarms)
      .toBe(results.evaluations.test.detectors.zscore_max.event.expected_events_detected_by_chance);
  });
  it('preserves secondary 2016 set and forbids supervised training-set evaluation', () => {
    const options = historicalDetectorOptions('dataset04');
    expect(options.map(x => x.key)).not.toContain('hist_gradient_boosting');
    expect(historicalDetectorEvidence('dataset04', 1, 'hist_gradient_boosting')).toBeNull();
    expect(historicalDetectorEvidence('test', 1, 'zscore_max')).toBeNull();
    expect(historicalDetectorEvidence('dataset04', 8, 'zscore_max')).toBeNull();
    const event = historicalDetectorEvidence('dataset04', 1, 'zscore_max');
    expect(event?.firstAlarmDelayHours).toBe(0);
    expect(event?.firstAlarmSourceLocal).toBe(HISTORICAL_SOURCE.attack_intervals[0].start);
    expect(historicalDetectorOptions('test').map(x => x.key))
      .toContain('hist_gradient_boosting');
  });
});
