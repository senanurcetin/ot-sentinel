import { z } from 'zod';
import raw from '@/data/batadal-case-study/results.json';
import { DETECTOR_LABELS, results, type Evaluation } from '@/lib/case-study';

/**
 * This explorer uses the checked-in results of the REAL OFFLINE BATADAL
 * benchmark. No per-hour CSV, raw 43-channel trace, device connection,
 * streaming telemetry or synthetic reconstructed measurements are included.
 */
const InventorySchema = z.object({
  data: z.object({
    features: z.array(z.string().regex(/^(?:L_T\d+|F_PU\d+|S_PU\d+|F_V\d+|S_V\d+|P_J\d+)$/)),
    constant_features_in_reference: z.array(z.string()),
  }),
  affected_signals: z.record(z.array(z.string())),
});
const inventory = InventorySchema.parse(raw);
const signals = inventory.data.features;
if (
  signals.length !== results.data.n_features ||
  signals.length !== new Set(signals).size ||
  inventory.data.constant_features_in_reference.some(code => !signals.includes(code)) ||
  Array.from({ length: 14 }, (_, i) => String(i + 1)).some(
    attack => !inventory.affected_signals[attack]?.length ||
    inventory.affected_signals[attack].some(code => !signals.includes(code))
  )
) {
  throw new Error('BATADAL feature inventory or attack labels are inconsistent with evaluated results');
}

export const BATADAL_GROUPS = [
  { id: 'all', label: 'All signals' },
  { id: 'tanks', label: 'Tank levels' },
  { id: 'pump_flow', label: 'Pump flows' },
  { id: 'pump_state', label: 'Pump states' },
  { id: 'valve_flow', label: 'Valve flows' },
  { id: 'valve_state', label: 'Valve states' },
  { id: 'pressure', label: 'Junction pressures' },
] as const;
export type BatadalGroup = typeof BATADAL_GROUPS[number]['id'];
export type BatadalSet = keyof typeof results.evaluations;

export function featureGroup(code: string): Exclude<BatadalGroup, 'all'> {
  if (/^L_T\d+$/.test(code)) return 'tanks';
  if (/^F_PU\d+$/.test(code)) return 'pump_flow';
  if (/^S_PU\d+$/.test(code)) return 'pump_state';
  if (/^F_V\d+$/.test(code)) return 'valve_flow';
  if (/^S_V\d+$/.test(code)) return 'valve_state';
  if (/^P_J\d+$/.test(code)) return 'pressure';
  throw new Error(`Unexpected BATADAL feature code: ${code}`);
}

export function signalInventory(set: BatadalSet, group: BatadalGroup = 'all') {
  const reportedTop = results.drift[set].top_features_share_of_hours_outside_reference_range;
  const affected = inventory.affected_signals;
  return signals
    .filter(code => group === 'all' || featureGroup(code) === group)
    .map(code => ({
      code,
      group: featureGroup(code),
      constantReference: inventory.data.constant_features_in_reference.includes(code),
      attackIds: Object.entries(affected)
        .filter(([, codes]) => codes.includes(code))
        .map(([id]) => Number(id))
        .sort((a, b) => a - b),
      // A missing key means "not among the published top drift features",
      // NEVER "0% drift" or "signal was healthy".
      reportedTopDriftFraction: Object.prototype.hasOwnProperty.call(reportedTop, code)
        ? reportedTop[code] : null,
    }));
}

export const benchmarkDetectorOptions = (set: BatadalSet) =>
  Object.keys(results.evaluations[set].detectors).map(id => ({
    id, label: DETECTOR_LABELS[id] ?? id,
  }));

export function attackEvidence(set: BatadalSet, detectorKey: string) {
  const detector = results.evaluations[set].detectors[detectorKey];
  if (!detector) return [];
  const explanations = new Map(
    (detector.explanation?.per_attack ?? []).map(e => [e.attack, e])
  );
  return detector.per_attack.map(entry => {
    const detail = explanations.get(entry.attack);
    return {
      id: entry.attack,
      durationHours: entry.duration_hours,
      detected: entry.detected,
      detectionDelayHours: entry.hours_to_detect,
      descriptionAffectedSignals: inventory.affected_signals[String(entry.attack)] ?? [],
      explanationAlarmedHours: detail?.alarmed_hours ?? null,
      explanationTop3HitRate: detail?.hit_rate ?? null,
    };
  });
}

export function detectorOverview(evaluation: Evaluation, key: string) {
  const detector = evaluation.detectors[key];
  if (!detector) return null;
  return {
    prAuc: detector.point.pr_auc,
    precision: detector.point.precision,
    recall: detector.point.recall,
    falseAlarmHourFraction: detector.event.false_alarm_hour_fraction,
    falseAlarmsPerDay: detector.event.false_alarms_per_day,
    expectedEventsByChance: detector.event.expected_events_detected_by_chance,
    eventsDetected: detector.event.events_detected,
    eventsTotal: detector.event.n_events,
    supervised: detector.supervised,
  };
}

export const BATADAL_PROVENANCE = {
  source: results.data_source,
  referenceRows: results.data.reference_rows,
  signals: results.data.n_features,
  protocolVersion: results.protocol.version,
  thresholdCalibration: results.protocol.threshold_source,
  fullRecordedTracesIncluded: false,
} as const;
