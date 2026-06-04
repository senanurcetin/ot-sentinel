import type { Metrics } from '@/lib/types';
import { scoreMetrics, buildLogEntry } from '@/lib/anomaly-scorer';
import { NextRequest, NextResponse } from 'next/server';

const getRandomNumber = (min: number, max: number) => Math.random() * (max - min) + min;

/**
 * Generates normal operating metrics.
 * Sensor values are drawn from the normal operating envelope; the anomaly
 * score and risk score are computed by the data-derived anomaly scorer
 * (src/lib/anomaly-scorer.ts) rather than hard-coded random ranges.
 */
const generateNormalData = (): Metrics => {
  const normalIPs = ['192.168.1.10', '192.168.1.12', '10.0.0.5', '10.0.0.6'];
  const sourceIp = normalIPs[Math.floor(Math.random() * normalIPs.length)];
  const sensorValues = {
    temp: parseFloat(getRandomNumber(40, 60).toFixed(2)),
    pressure: parseFloat(getRandomNumber(1000, 1020).toFixed(2)),
    vibration: parseFloat(getRandomNumber(0.01, 0.1).toFixed(2)),
  };
  const scored = scoreMetrics(sensorValues);

  return {
    timestamp: new Date().toISOString(),
    metrics: sensorValues,
    network_traffic: sourceIp,
    traffic_volume: parseFloat(getRandomNumber(50, 200).toFixed(2)),
    status: scored.status,
    anomaly_score: scored.anomaly_score,
    risk_score: scored.risk_score,
    per_sensor_contributions: scored.per_sensor_contributions,
    log_entry: buildLogEntry(scored, sourceIp),
  };
};

/**
 * Generates anomalous metrics representing a simulated attack or fault.
 * Sensor values exceed normal operating envelope; the scorer computes
 * high z-scores → high risk score → CRITICAL status automatically.
 */
const generateAnomalyData = (): Metrics => {
  const suspiciousIPs = ['203.0.113.45', '198.51.100.22', '8.8.8.8', '1.1.1.1'];
  const sourceIp = suspiciousIPs[Math.floor(Math.random() * suspiciousIPs.length)];
  const sensorValues = {
    temp: parseFloat(getRandomNumber(100, 150).toFixed(2)),
    pressure: parseFloat(getRandomNumber(1100, 1200).toFixed(2)),
    vibration: parseFloat(getRandomNumber(0.8, 2.5).toFixed(2)),
  };
  const scored = scoreMetrics(sensorValues);

  return {
    timestamp: new Date().toISOString(),
    metrics: sensorValues,
    network_traffic: sourceIp,
    traffic_volume: parseFloat(getRandomNumber(1000, 5000).toFixed(2)),
    status: scored.status,
    anomaly_score: scored.anomaly_score,
    risk_score: scored.risk_score,
    per_sensor_contributions: scored.per_sensor_contributions,
    log_entry: buildLogEntry(scored, sourceIp),
  };
};

/**
 * API route handler for GET requests.
 * It determines whether to generate normal or anomaly data based on the 'attack' query parameter.
 * @param req - The Next.js API request object.
 * @returns A NextResponse object containing the generated metrics data in JSON format.
 */
export async function GET(req: NextRequest) {
  try {
    const isAttack = req.nextUrl.searchParams.get('attack') === 'true';
    const data = isAttack ? generateAnomalyData() : generateNormalData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 });
  }
}
