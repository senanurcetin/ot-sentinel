import type { Metrics } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

const getRandomNumber = (min: number, max: number) => Math.random() * (max - min) + min;

const generateNormalData = (): Metrics => {
  const temp = getRandomNumber(40, 60);
  const normalIPs = [
    '192.168.1.10',
    '192.168.1.12',
    '10.0.0.5',
    '10.0.0.6',
  ];
  const sourceIp = normalIPs[Math.floor(Math.random() * normalIPs.length)];

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      temp: parseFloat(temp.toFixed(2)),
      pressure: parseFloat(getRandomNumber(1000, 1020).toFixed(2)),
      vibration: parseFloat(getRandomNumber(0.01, 0.1).toFixed(2)),
    },
    network_traffic: sourceIp,
    traffic_volume: parseFloat(getRandomNumber(50, 200).toFixed(2)),
    status: 'SECURE',
    anomaly_score: parseFloat(getRandomNumber(0.05, 0.2).toFixed(2)),
    log_entry: 'Status check OK',
  };
};

const generateAnomalyData = (): Metrics => {
  const temp = getRandomNumber(100, 150);
  const suspiciousIPs = [
    '203.0.113.45',
    '198.51.100.22',
    '8.8.8.8',
    '1.1.1.1',
  ];
  const sourceIp = suspiciousIPs[Math.floor(Math.random() * suspiciousIPs.length)];

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      temp: parseFloat(temp.toFixed(2)),
      pressure: parseFloat(getRandomNumber(1100, 1200).toFixed(2)),
      vibration: parseFloat(getRandomNumber(0.8, 2.5).toFixed(2)),
    },
    network_traffic: sourceIp,
    traffic_volume: parseFloat(getRandomNumber(1000, 5000).toFixed(2)),
    status: 'CRITICAL',
    anomaly_score: parseFloat(getRandomNumber(0.85, 0.99).toFixed(2)),
    log_entry: `CRITICAL ANOMALY! Unrecognized IP: ${sourceIp}`,
  };
};

export async function GET(req: NextRequest) {
  try {
    const isAttack = req.nextUrl.searchParams.get('attack') === 'true';
    const data = isAttack ? generateAnomalyData() : generateNormalData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500 });
  }
}
