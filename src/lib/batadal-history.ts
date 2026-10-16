import { z } from 'zod';
import raw from '@/data/batadal-case-study/verified-hourly-dataset04.json';
import reference from '@/data/batadal-case-study/results.json';

const Time = z.string().regex(/^2016-\d\d-\d\dT\d\d:00:00$/);
const Digest = '4746beab2cfcdb5e68c7fa197a7522aecb70189d61dcc3eb1f870d2ce387068b';
const DatasetSchema = z.object({
  schema: z.literal('ot-sentinel/batadal-hourly-source-window/v1'),
  dataset: z.literal('dataset04'),
  provenance: z.object({
    source_sha256: z.literal(Digest),
    source_total_rows: z.literal(4177),
    timezone: z.string().includes('unspecified'),
    source_git_blob: z.literal('9582e58fbbfcfc66f3257062b565537b7a965eb3'),
  }),
  feature_names: z.array(z.string()).length(43),
  window_padding_hours: z.literal(12),
  attack_intervals: z.array(z.object({
    id: z.number().int().min(1).max(7),
    start: Time, end: Time, duration_hours: z.number().int().positive(),
  })).length(7),
  windows: z.array(z.object({
    attack_id: z.number().int().min(1).max(7),
    window_start: Time, window_end: Time,
    rows: z.array(z.object({
      timestamp: Time,
      values: z.array(z.number().finite()).length(43),
    })),
  })).length(7),
});
export type HistoricalSignalGroup = 'all' | 'levels' | 'flows' | 'states' | 'pressures';
export const HISTORICAL_SIGNAL_GROUPS: Array<{ value: HistoricalSignalGroup; label: string }> = [
  { value: 'all', label: 'All 43 signals' },
  { value: 'levels', label: 'Tank levels (m)' },
  { value: 'flows', label: 'Pump/valve flows (LPS)' },
  { value: 'states', label: 'Pump/valve states (0/1)' },
  { value: 'pressures', label: 'Junction pressures (m)' },
];

function hour(ms: string): number {
  // Numeric differences are only used to validate source-local hourly order;
  // displaying "UTC" for these source-naive timestamps would be misleading.
  const parsed = Date.parse(ms + 'Z');
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 19) !== ms) {
    throw new Error('BATADAL original hourly timestamp malformed');
  }
  return parsed;
}

export function validateHistoricalExport(input: unknown) {
  const data = DatasetSchema.parse(input);
  if (data.feature_names.some((f, i) => f !== reference.data.features[i]) ||
      new Set(data.feature_names).size !== 43) {
    throw new Error('BATADAL 43-signal inventory does not match evaluated data');
  }
  for (let i = 0; i < 7; i++) {
    const attack = data.attack_intervals[i];
    const window = data.windows[i];
    if (attack.id !== i + 1 || window.attack_id !== attack.id ||
        hour(attack.end) - hour(attack.start) !== (attack.duration_hours - 1) * 3600_000 ||
        hour(window.window_start) !== hour(attack.start) - 12 * 3600_000 ||
        hour(window.window_end) !== hour(attack.end) + 12 * 3600_000 ||
        window.rows.length !== attack.duration_hours + 24 ||
        window.rows[0].timestamp !== window.window_start ||
        window.rows[window.rows.length - 1].timestamp !== window.window_end ||
        data.windows[i].rows.some((row, j) =>
          hour(row.timestamp) !== hour(window.window_start) + j * 3600_000)) {
      throw new Error(`BATADAL 2016 attack #${attack.id} has invalid source chronology/window`);
    }
    const reported = reference.evaluations.train.detectors.zscore_max.per_attack[i];
    if (reported.attack !== attack.id || reported.duration_hours !== attack.duration_hours) {
      throw new Error('BATADAL attack intervals disagree with measured benchmark protocol');
    }
  }
  return data;
}

export const HISTORICAL_SOURCE = validateHistoricalExport(raw);

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

/** Original measurements only; no model score, future fill, or interpolation. */
export function historicalAttackPoints(attackId: number, signal: string) {
  const signalIndex = HISTORICAL_SOURCE.feature_names.indexOf(signal);
  const interval = HISTORICAL_SOURCE.attack_intervals.find(a => a.id === attackId);
  const window = HISTORICAL_SOURCE.windows.find(w => w.attack_id === attackId);
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
