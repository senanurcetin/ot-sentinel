import { z } from 'zod';
import raw from '@/data/batadal-case-study/results.json';

/**
 * View model for the /case-study page. The numbers come from
 * `src/data/batadal-case-study/results.json`, produced by `analysis/run_batadal_case_study.py`;
 * nothing is typed by hand here. The JSON is validated at module load, so a malformed or
 * synthetic results file fails the build instead of rendering nonsense.
 */
const Nullable = z.number().nullable();
const Interval = z.array(z.number()).length(2);

/** Protocol v3 fields are optional so an older (v2) results file still parses. */
const ExplanationSchema = z.object({
  top_k: z.number(),
  alarmed_attack_hours: z.number(),
  hit_rate: Nullable,
  chance: Nullable,
  per_attack: z.array(
    z.object({ attack: z.number(), alarmed_hours: z.number(), hit_rate: Nullable, chance: z.number() })
  ),
});

const BootstrapSchema = z.object({
  n_boot: z.number(),
  reference: z.string().nullable(),
  intervals: z.record(z.record(Interval)),
});

const DecisionSchema = z.object({
  reference: z.string(),
  evaluated_on: z.string(),
  detectors: z.record(
    z.object({ pr_auc_diff_interval: Interval.nullable(), better_than_reference: z.boolean() })
  ),
});

const DetectorSchema = z.object({
  supervised: z.boolean(),
  threshold: z.number(),
  point: z.object({
    precision: Nullable,
    recall: Nullable,
    f1: Nullable,
    pr_auc: Nullable,
  }),
  event: z.object({
    n_events: z.number(),
    events_detected: z.number(),
    median_time_to_detect_h: Nullable,
    false_alarms_per_day: Nullable,
    false_alarm_hour_fraction: Nullable,
    expected_events_detected_by_chance: Nullable,
  }),
  per_attack: z.array(
    z.object({
      attack: z.number(),
      duration_hours: z.number(),
      detected: z.boolean(),
      hours_to_detect: Nullable,
    })
  ),
  explanation: ExplanationSchema.nullable().optional(),
});

const EvaluationSchema = z.object({
  attacks: z.number(),
  attack_hours: z.number(),
  attack_free_hours: z.number(),
  detectors: z.record(DetectorSchema),
  not_evaluated: z.array(z.string()).optional(),
  bootstrap: BootstrapSchema.optional(),
});

const DriftSchema = z.object({
  normal_hours: z.number(),
  share_of_hours_with_any_feature_outside_reference_range: z.number(),
  top_features_share_of_hours_outside_reference_range: z.record(z.number()),
});

export const ResultsSchema = z.object({
  data_source: z.string(),
  protocol: z.object({
    version: z.number(),
    max_false_alarms_per_day: z.number(),
    threshold_source: z.string(),
    supervised_trained_on: z.string(),
  }),
  data: z.object({
    reference_rows: z.number(),
    n_features: z.number(),
    constant_features_in_reference: z.array(z.string()),
  }),
  evaluations: z.object({ test: EvaluationSchema, train: EvaluationSchema }),
  decision: DecisionSchema.optional(),
  drift: z.object({ test: DriftSchema, train: DriftSchema }),
  limitations: z.array(z.string()),
});

export type Results = z.infer<typeof ResultsSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;

export function parseResults(input: unknown): Results {
  const results = ResultsSchema.parse(input);
  if (!results.data_source.startsWith('BATADAL') || results.data_source.includes('NOT BATADAL')) {
    throw new Error(`case study results are not from BATADAL: "${results.data_source}"`);
  }
  return results;
}

export const results: Results = parseResults(raw);

export const DETECTOR_LABELS: Record<string, string> = {
  static_limits: 'Static limits',
  zscore_max: 'Max absolute z-score',
  ewma_z: 'EWMA of z-scores (v3)',
  cusum: 'CUSUM (v3)',
  rolling_residual: '24 h rolling residual (v3)',
  isolation_forest: 'Isolation Forest',
  hist_gradient_boosting: 'Gradient boosting (supervised) †',
};

export const SET_TITLES = {
  test: 'Test set (attacks 8-14, Jan-Mar 2017): headline',
  train: 'dataset04 (attacks 1-7, Jul-Dec 2016): secondary',
} as const;

/**
 * `v` rounded half-up to `digits` decimals, as an integer. results.json stores 4 decimals; float
 * formatting (Python's round-half-even, JavaScript's toFixed) disagrees on exact ties such as
 * 0.1825, so the README (rendered by analysis/results_report.py) and this page use the same
 * integer rule and always show the same number.
 */
function scaled(v: number, digits: number): number {
  const stored = Math.round(v * 10_000);
  const drop = 4 - digits;
  return drop > 0 ? Math.floor((stored + 5 * 10 ** (drop - 1)) / 10 ** drop) : stored;
}

export const pct = (v: number | null): string =>
  v === null ? 'n/a' : `${(scaled(v, 3) / 10).toFixed(1)} %`;
export const fixed = (v: number | null, digits = 3): string =>
  v === null ? 'n/a' : (scaled(v, digits) / 10 ** digits).toFixed(digits);
export const hours = (v: number | null): string => (v === null ? 'n/a' : String(v));
export const interval = (bounds: number[] | null | undefined, digits = 3): string =>
  bounds ? `${fixed(bounds[0], digits)} to ${fixed(bounds[1], digits)}` : 'n/a';

export function baseRate(evaluation: Evaluation): number {
  return evaluation.attack_hours / (evaluation.attack_hours + evaluation.attack_free_hours);
}

export type SummaryRow = {
  key: string;
  label: string;
  caught: string;
  expectedByChance: string;
  medianHours: string;
  alarmHoursNormal: string;
  precision: string;
  attackHoursCaught: string;
  prAuc: string;
  prAucInterval: string;
};

export function summaryRows(evaluation: Evaluation): SummaryRow[] {
  return Object.entries(evaluation.detectors).map(([key, d]) => ({
    key,
    label: DETECTOR_LABELS[key] ?? key,
    caught: `${d.event.events_detected} of ${d.event.n_events}`,
    expectedByChance: fixed(d.event.expected_events_detected_by_chance, 1),
    medianHours: hours(d.event.median_time_to_detect_h),
    alarmHoursNormal: pct(d.event.false_alarm_hour_fraction),
    precision: pct(d.point.precision),
    attackHoursCaught: pct(d.point.recall),
    prAuc: fixed(d.point.pr_auc),
    prAucInterval: interval(evaluation.bootstrap?.intervals[key]?.pr_auc),
  }));
}

export type DecisionRow = { key: string; label: string; difference: string; better: boolean };

/** Protocol v3 decision rule, one row per temporal detector (empty for a v2 results file). */
export function decisionRows(r: Results): DecisionRow[] {
  return Object.entries(r.decision?.detectors ?? {}).map(([key, d]) => ({
    key,
    label: DETECTOR_LABELS[key] ?? key,
    difference: interval(d.pr_auc_diff_interval),
    better: d.better_than_reference,
  }));
}

export type ExplanationRow = {
  key: string;
  label: string;
  alarmedHours: number;
  hitRate: string;
  chance: string;
};

/** Explanation accuracy for detectors with a per-signal score. */
export function explanationRows(evaluation: Evaluation): ExplanationRow[] {
  return Object.entries(evaluation.detectors).flatMap(([key, d]) =>
    d.explanation
      ? [
          {
            key,
            label: DETECTOR_LABELS[key] ?? key,
            alarmedHours: d.explanation.alarmed_attack_hours,
            hitRate: pct(d.explanation.hit_rate),
            chance: pct(d.explanation.chance),
          },
        ]
      : []
  );
}

export type PerAttackRow = { attack: number; durationHours: number; cells: string[] };

export function perAttackRows(evaluation: Evaluation): { columns: string[]; rows: PerAttackRow[] } {
  const keys = Object.keys(evaluation.detectors);
  const first = evaluation.detectors[keys[0]].per_attack;
  const rows = first.map((row) => ({
    attack: row.attack,
    durationHours: row.duration_hours,
    cells: keys.map((k) => {
      const r = evaluation.detectors[k].per_attack.find((x) => x.attack === row.attack);
      return r && r.detected ? hours(r.hours_to_detect) : 'missed';
    }),
  }));
  return { columns: keys.map((k) => DETECTOR_LABELS[k] ?? k), rows };
}
