import { scoreMetrics, type SensorReadings } from '@/lib/anomaly-scorer';
import type { TelemetryMode, TelemetrySource } from '@/lib/telemetry-source';
import type { Metrics } from '@/lib/types';

/**
 * Offline-only, read-only replay of an explicitly provided three-sensor recording.
 * It is not a BATADAL 43-signal adapter, PLC/Modbus client, or live dashboard source.
 */
export type RecordedThreeSensorRow = {
  timestamp: string;
  metrics: SensorReadings;
};

export const MAX_REPLAY_ROWS = 10_000;

const SENSOR_NAMES = ['temp', 'pressure', 'vibration'] as const;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Enforce an explicit UTC timestamp and reject rollover dates such as 30 February. */
function parseUtcTimestamp(timestamp: unknown): number {
  if (typeof timestamp !== 'string' || !UTC_TIMESTAMP.test(timestamp)) {
    throw new RangeError('Replay timestamp must be an explicit ISO-8601 UTC time');
  }
  const millis = Date.parse(timestamp);
  const canonical = timestamp.includes('.') ? timestamp : timestamp.replace('Z', '.000Z');
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== canonical) {
    throw new RangeError('Replay timestamp is not a valid UTC instant');
  }
  return millis;
}

/**
 * Immutable-internal-snapshot, finite, monotonically increasing recorded source.
 * No external file or network access. The `attack` toggle is deliberately ignored:
 * replay is data-driven and must not overwrite evidence to satisfy a UI toggle.
 *
 * Exhaustion throws rather than silently looping old evidence as new telemetry.
 * For a new run, construct a new instance from the original rows.
 */
export class RecordedTelemetrySource implements TelemetrySource {
  readonly name = 'offline-three-sensor-replay';
  private cursor = 0;
  private readonly samples: Metrics[];

  constructor(rows: readonly RecordedThreeSensorRow[]) {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > MAX_REPLAY_ROWS) {
      throw new RangeError('Replay requires 1 to 10000 recorded three-sensor rows');
    }
    let previous = -Infinity;
    this.samples = rows.map((row, index) => {
      const millis = parseUtcTimestamp(row?.timestamp);
      if (millis <= previous) {
        throw new RangeError('Replay timestamps must increase strictly without duplicates');
      }
      previous = millis;
      // A recording row is only a timestamp plus the three supported sensor values.
      // Reject extra fields rather than carrying unverified metadata into scored evidence.
      if (Object.keys(row).some((key) => key !== 'timestamp' && key !== 'metrics')) {
        throw new RangeError('Replay row contains unsupported fields');
      }
      if (!row.metrics || typeof row.metrics !== 'object' || Array.isArray(row.metrics) ||
          Object.keys(row.metrics).length !== SENSOR_NAMES.length ||
          Object.keys(row.metrics).some((key) => !SENSOR_NAMES.includes(key as typeof SENSOR_NAMES[number]))) {
        throw new RangeError('Replay metrics must contain exactly temp, pressure and vibration');
      }
      for (const sensor of SENSOR_NAMES) {
        if (!row.metrics || !Number.isFinite(row.metrics[sensor])) {
          throw new RangeError(`Invalid recorded ${sensor} at row ${index}`);
        }
      }
      const metrics: SensorReadings = {
        temp: row.metrics.temp,
        pressure: row.metrics.pressure,
        vibration: row.metrics.vibration,
      };
      const result = scoreMetrics(metrics);
      return {
        timestamp: row.timestamp,
        metrics,
        network_traffic: 'NOT RECORDED — OFFLINE REPLAY',
        traffic_volume: 0,
        status: result.status,
        anomaly_score: result.anomaly_score,
        risk_score: result.risk_score,
        per_sensor_contributions: result.per_sensor_contributions,
        log_entry: `OFFLINE THREE-SENSOR REPLAY — risk ${result.risk_score}/100. Network traffic not measured.`,
      };
    });
  }

  next(_mode: TelemetryMode): Metrics {
    const sample = this.samples[this.cursor];
    if (!sample) throw new RangeError('Recorded telemetry exhausted; replay stopped');
    this.cursor += 1;
    return {
      ...sample,
      metrics: { ...sample.metrics },
      per_sensor_contributions: sample.per_sensor_contributions.map(item => ({ ...item })),
    };
  }
}
