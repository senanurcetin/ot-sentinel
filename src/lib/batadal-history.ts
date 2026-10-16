import { z } from 'zod';
import normalHistory from '@/data/batadal-case-study/verified-hourly-dataset04.json';
import unseenHistory from '@/data/batadal-case-study/verified-hourly-test.json';
import reference from '@/data/batadal-case-study/results.json';
import { results, DETECTOR_LABELS } from '@/lib/case-study';

export type HistoricalDataset = 'dataset04' | 'test';
const Time = z.string().regex(/^201[67]-\d\d-\d\dT\d\d:00:00$/);
const DatasetSchema = z.object({
  schema: z.literal('ot-sentinel/batadal-hourly-source-window/v1'),
  dataset: z.enum(['dataset04', 'test']),
  provenance: z.object({
    source_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    source_total_rows: z.number().int().positive(),
    timezone: z.string().includes('unspecified'),
    source_git_blob: z.string().regex(/^[0-9a-f]{40}$/),
  }),
  feature_names: z.array(z.string()).length(43),
  window_padding_hours: z.literal(12),
  attack_intervals: z.array(z.object({
    id: z.number().int().min(1).max(14),
    start: Time, end: Time, duration_hours: z.number().int().positive(),
  })).length(7),
  windows: z.array(z.object({
    attack_id: z.number().int().min(1).max(14),
    window_start: Time, window_end: Time,
    rows: z.array(z.object({
      timestamp: Time, values: z.array(z.number().finite()).length(43),
    })),
  })).length(7),
});

const PINS = {
  dataset04: {
    year: '2016', firstAttack: 1, originalRows: 4177,
    sha256: '4746beab2cfcdb5e68c7fa197a7522aecb70189d61dcc3eb1f870d2ce387068b',
    blob: '9582e58fbbfcfc66f3257062b565537b7a965eb3',
    evaluation: 'train',
  },
  test: {
    year: '2017', firstAttack: 8, originalRows: 2089,
    sha256: '27e4a15eca583fca8bf133360866189f50af982899ad18b66dff70fb78d1a6fa',
    blob: '17301034d0cb20168a093ba28065163e73d9d8df',
    evaluation: 'test',
  },
} as const;

export type HistoricalSignalGroup = 'all' | 'levels' | 'flows' | 'states' | 'pressures';
export const HISTORICAL_SIGNAL_GROUPS: Array<{ value: HistoricalSignalGroup; label: string }> = [
  { value: 'all', label: 'All 43 signals' },
  { value: 'levels', label: 'Tank levels (m)' },
  { value: 'flows', label: 'Pump/valve flows (LPS)' },
  { value: 'states', label: 'Pump/valve states (0/1)' },
  { value: 'pressures', label: 'Junction pressures (m)' },
];

function hour(ms: string): number {
  // UTC parsing is used only for arithmetic with *naive* source-local hours;
  // it is NOT an assertion about source timezone.
  const parsed = Date.parse(ms + 'Z');
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 19) !== ms) {
    throw new Error('BATADAL source-local hourly timestamp malformed');
  }
  return parsed;
}

export function validateHistoricalExport(input: unknown, expected: HistoricalDataset = 'dataset04') {
  const data = DatasetSchema.parse(input);
  const pin = PINS[expected];
  if (data.dataset !== expected ||
      data.provenance.source_sha256 !== pin.sha256 ||
      data.provenance.source_total_rows !== pin.originalRows ||
      data.provenance.source_git_blob !== pin.blob ||
      data.feature_names.some((f, i) => f !== reference.data.features[i]) ||
      new Set(data.feature_names).size !== 43) {
    throw new Error('BATADAL official source hash, dataset or 43-signal inventory mismatch');
  }
  for (let i = 0; i < 7; i++) {
    const attack = data.attack_intervals[i];
    const window = data.windows[i];
    if (attack.id !== pin.firstAttack + i || window.attack_id !== attack.id ||
        !attack.start.startsWith(pin.year) || !window.window_start.startsWith(pin.year) ||
        hour(attack.end) - hour(attack.start) !== (attack.duration_hours - 1) * 3600_000 ||
        hour(window.window_start) !== hour(attack.start) - 12 * 3600_000 ||
        hour(window.window_end) !== hour(attack.end) + 12 * 3600_000 ||
        window.rows.length !== attack.duration_hours + 24 ||
        window.rows[0].timestamp !== window.window_start ||
        window.rows[window.rows.length - 1].timestamp !== window.window_end ||
        window.rows.some((row, j) =>
          hour(row.timestamp) !== hour(window.window_start) + j * 3600_000)) {
      throw new Error(`BATADAL ${pin.year} attack #${attack.id} has invalid source chronology/window`);
    }
    const reported = reference.evaluations[pin.evaluation].detectors.zscore_max.per_attack[i];
    if (reported.attack !== attack.id || reported.duration_hours !== attack.duration_hours) {
      throw new Error('BATADAL attack intervals disagree with independent benchmark results');
    }
  }
  return data;
}

export const HISTORICAL_SOURCE = validateHistoricalExport(normalHistory, 'dataset04');
export const HISTORICAL_TEST_SOURCE = validateHistoricalExport(unseenHistory, 'test');

export function getHistoricalSource(dataset: HistoricalDataset = 'dataset04') {
  return dataset === 'test' ? HISTORICAL_TEST_SOURCE : HISTORICAL_SOURCE;
}

export function signalGroup(code: string): Exclude<HistoricalSignalGroup, 'all'> {
  if (code.startsWith('L_')) return 'levels';
  if (code.startsWith('F_')) return 'flows';
  if (code.startsWith('S_')) return 'states';
  if (code.startsWith('P_')) return 'pressures';
  throw new Error('Not a BATADAL feature code');
}

export function signalUnit(code: string): string {
  switch (signalGroup(code)) {
    case 'flows': return 'LPS';
    case 'states': return 'on/off';
    default: return 'm';
  }
}

/** Pinned original measurements only, never inferred/interpolated values. */
export function historicalAttackPoints(
  attackId: number, signal: string, dataset: HistoricalDataset = 'dataset04'
) {
  const source = getHistoricalSource(dataset);
  const signalIndex = source.feature_names.indexOf(signal);
  const interval = source.attack_intervals.find(a => a.id === attackId);
  const window = source.windows.find(w => w.attack_id === attackId);
  if (signalIndex < 0 || !interval || !window) return [];
  return window.rows.map(row => ({
    timestamp: row.timestamp,
    value: row.values[signalIndex],
    publishedAttackInterval: row.timestamp >= interval.start && row.timestamp <= interval.end,
  }));
}

export function historicalSignalOptions(group: HistoricalSignalGroup) {
  return HISTORICAL_SOURCE.feature_names.filter(code => group === 'all' || signalGroup(code) === group);
}

/**
 * Retrospective, already-published benchmark summary; NEVER new inference,
 * sample-by-sample risk or evidence from the historical sensor values.
 */
export function historicalDetectorOptions(dataset: HistoricalDataset) {
  const evaluation = results.evaluations[dataset === 'test' ? 'test' : 'train'];
  return Object.keys(evaluation.detectors).map(key => ({
    key, label: DETECTOR_LABELS[key] ?? key,
  }));
}

export function historicalDetectorEvidence(
  dataset: HistoricalDataset, attackId: number, detectorKey: string
) {
  const source = getHistoricalSource(dataset);
  const evaluation = results.evaluations[dataset === 'test' ? 'test' : 'train'];
  const detector = evaluation.detectors[detectorKey];
  const interval = source.attack_intervals.find(x => x.id === attackId);
  if (!detector || !interval) return null;
  const report = detector.per_attack.find(x => x.attack === attackId);
  if (!report || report.duration_hours !== interval.duration_hours) {
    throw new Error('BATADAL detector report does not agree with verified attack period');
  }
  const delay = report.detected ? report.hours_to_detect : null;
  if (delay !== null && (delay < 0 || delay >= interval.duration_hours || !Number.isFinite(delay))) {
    throw new Error('BATADAL retrospective delay is outside published attack period');
  }
  // Source-local calendar arithmetic only; the original BATADAL timestamps
  // have no declared timezone. Do not present these as UTC instants.
  const firstAlarmLocal = delay === null ? null
    : new Date(hour(interval.start) + delay * 3_600_000).toISOString().slice(0, 19);
  return {
    attackId,
    detectorKey,
    detected: report.detected,
    firstAlarmDelayHours: delay,
    firstAlarmSourceLocal: firstAlarmLocal,
    falseAlarmsPerDay: detector.event.false_alarms_per_day,
    expectedEventsFromFalseAlarms: detector.event.expected_events_detected_by_chance,
  };
}
