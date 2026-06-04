/**
 * Data-derived OT anomaly scorer.
 *
 * Replaces hard-coded rule-based anomaly scores (0.05-0.2 normal,
 * 0.85-0.99 attack) with z-score-based scoring derived from Isolation
 * Forest training on simulated normal operating telemetry.
 *
 * Parameters are sourced from analysis/model-params.json.
 * See analysis/train_anomaly_model.py for the training pipeline.
 */

// --- Model parameters (derived from analysis/train_anomaly_model.py) ---

const SENSOR_STATS = {
  temp: { mean: 50.0, std: 3.3333, zWarning: 2.0, zCritical: 3.0 },
  pressure: { mean: 1010.0, std: 3.3333, zWarning: 2.0, zCritical: 3.0 },
  vibration: { mean: 0.055, std: 0.015, zWarning: 2.0, zCritical: 3.0 },
} as const;

const SENSOR_WEIGHTS = {
  temp: 0.4,
  pressure: 0.3,
  vibration: 0.3,
} as const;

// Risk score = round(min(100, 100 * (1 - exp(-0.25 * compositeZ))))
// Maps z-score 0→0, 1→22, 2→39, 3→53, 4→63, 5→71
const RISK_SCORE_DECAY = 0.25;

// Status boundary: risk_score >= 50 → CRITICAL
const CRITICAL_THRESHOLD = 50;

// --- Types ---

export type SensorContribution = {
  sensor: string;
  z_score: number;
  contribution_pct: number;
  status: 'normal' | 'warning' | 'critical';
};

export type AnomalyScoreResult = {
  anomaly_score: number;
  risk_score: number;
  status: 'SECURE' | 'CRITICAL';
  per_sensor_contributions: SensorContribution[];
};

// --- Scoring functions ---

function computeZScore(value: number, mean: number, std: number): number {
  return Math.abs((value - mean) / (std + 1e-10));
}

function sensorStatus(z: number, warning: number, critical: number): 'normal' | 'warning' | 'critical' {
  if (z >= critical) return 'critical';
  if (z >= warning) return 'warning';
  return 'normal';
}

/**
 * Compute anomaly score and risk score for a set of OT sensor readings.
 *
 * Returns:
 *   - anomaly_score: [0, 1] — backward-compatible with existing API contract
 *   - risk_score:    [0, 100] — continuous severity score for richer UI
 *   - status:        'SECURE' | 'CRITICAL' — operational alert level
 *   - per_sensor_contributions: which sensors are driving the anomaly
 */
export function scoreMetrics(metrics: {
  temp: number;
  pressure: number;
  vibration: number;
}): AnomalyScoreResult {
  const zScores = {
    temp: computeZScore(metrics.temp, SENSOR_STATS.temp.mean, SENSOR_STATS.temp.std),
    pressure: computeZScore(metrics.pressure, SENSOR_STATS.pressure.mean, SENSOR_STATS.pressure.std),
    vibration: computeZScore(metrics.vibration, SENSOR_STATS.vibration.mean, SENSOR_STATS.vibration.std),
  };

  // Weighted composite z-score
  const compositeZ =
    zScores.temp * SENSOR_WEIGHTS.temp +
    zScores.pressure * SENSOR_WEIGHTS.pressure +
    zScores.vibration * SENSOR_WEIGHTS.vibration;

  // Risk score: exponential mapping 0-100
  const riskScore = Math.round(Math.min(100, Math.max(0, 100 * (1 - Math.exp(-RISK_SCORE_DECAY * compositeZ)))));

  // Anomaly score: normalized to [0,1] — backward-compatible field
  const rawMax = Math.max(zScores.temp, zScores.pressure, zScores.vibration);
  const anomalyScore = parseFloat(Math.min(0.99, Math.max(0.01, 1 - Math.exp(-0.15 * rawMax))).toFixed(3));

  const status: 'SECURE' | 'CRITICAL' = riskScore >= CRITICAL_THRESHOLD ? 'CRITICAL' : 'SECURE';

  // Per-sensor contributions (% of composite z-score)
  const totalZ = zScores.temp + zScores.pressure + zScores.vibration + 1e-10;
  const contributions: SensorContribution[] = [
    {
      sensor: 'temp',
      z_score: parseFloat(zScores.temp.toFixed(2)),
      contribution_pct: parseFloat(((zScores.temp / totalZ) * 100).toFixed(1)),
      status: sensorStatus(zScores.temp, SENSOR_STATS.temp.zWarning, SENSOR_STATS.temp.zCritical),
    },
    {
      sensor: 'pressure',
      z_score: parseFloat(zScores.pressure.toFixed(2)),
      contribution_pct: parseFloat(((zScores.pressure / totalZ) * 100).toFixed(1)),
      status: sensorStatus(zScores.pressure, SENSOR_STATS.pressure.zWarning, SENSOR_STATS.pressure.zCritical),
    },
    {
      sensor: 'vibration',
      z_score: parseFloat(zScores.vibration.toFixed(2)),
      contribution_pct: parseFloat(((zScores.vibration / totalZ) * 100).toFixed(1)),
      status: sensorStatus(zScores.vibration, SENSOR_STATS.vibration.zWarning, SENSOR_STATS.vibration.zCritical),
    },
  ].sort((a, b) => b.z_score - a.z_score);

  return {
    anomaly_score: anomalyScore,
    risk_score: riskScore,
    status,
    per_sensor_contributions: contributions,
  };
}

/**
 * Generate a human-readable log entry based on sensor contributions.
 */
export function buildLogEntry(
  result: AnomalyScoreResult,
  sourceIp: string,
): string {
  if (result.status === 'CRITICAL') {
    const topSensor = result.per_sensor_contributions[0];
    return (
      `ANOMALY DETECTED — Risk score ${result.risk_score}/100. ` +
      `Primary driver: ${topSensor.sensor} (z=${topSensor.z_score}). ` +
      `Source IP: ${sourceIp}`
    );
  }
  const topAnomalous = result.per_sensor_contributions.find(c => c.status !== 'normal');
  if (topAnomalous) {
    return `Advisory: ${topAnomalous.sensor} at z=${topAnomalous.z_score} — within tolerance, monitoring. IP: ${sourceIp}`;
  }
  return 'Status check OK — all sensors within normal operating envelope.';
}
