import { render, screen } from '@testing-library/react';
import OfflineReplayTrends from '@/components/offline-replay-trends';
import type { Metrics } from '@/lib/types';

const sample = (risk: number, status: Metrics['status'], timestamp: string): Metrics => ({
  timestamp,
  metrics: { temp: 50, pressure: 1010, vibration: 0.055 },
  network_traffic: 'NOT RECORDED — OFFLINE REPLAY',
  traffic_volume: 0,
  status,
  anomaly_score: 0.5,
  risk_score: risk,
  per_sensor_contributions: [],
  log_entry: 'OFFLINE THREE-SENSOR REPLAY',
});

describe('OfflineReplayTrends', () => {
  it('renders an honest empty state with no implied live chart', () => {
    render(<OfflineReplayTrends samples={[]} />);
    expect(screen.getByText('No historical samples reviewed yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Historical sample trend charts' })).not.toBeInTheDocument();
  });

  it('summarizes only inspected historical rows and separates them from live telemetry', () => {
    render(<OfflineReplayTrends samples={[
      sample(16, 'SECURE', '2026-10-16T10:00:00Z'),
      sample(82, 'CRITICAL', '2026-10-16T10:00:01Z'),
    ]} />);
    expect(screen.getByRole('region', { name: 'Historical sample trend charts' })).toBeInTheDocument();
    expect(screen.getByText('2 samples in view')).toBeInTheDocument();
    expect(screen.getByText('82/100')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText(/No live data, network measurements, interpolation/)).toBeInTheDocument();
  });
});
