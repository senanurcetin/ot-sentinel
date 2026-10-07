import { render, screen } from '@testing-library/react';
import SensorContributions from './sensor-contributions';

describe('SensorContributions', () => {
  it('shows a waiting state without telemetry', () => {
    render(<SensorContributions contributions={[]} riskScore={null} />);
    expect(screen.getByText(/Waiting for telemetry/)).toBeInTheDocument();
  });

  it('renders each sensor with its z-score, status and the risk score', () => {
    render(
      <SensorContributions
        riskScore={72}
        contributions={[
          { sensor: 'vibration', z_score: 9.5, contribution_pct: 80, status: 'critical' },
          { sensor: 'temp', z_score: 0.4, contribution_pct: 5, status: 'normal' },
        ]}
      />
    );
    expect(screen.getByText(/Current risk score: 72\/100/)).toBeInTheDocument();
    expect(screen.getByText(/z = 9\.50 · 80% · critical/)).toBeInTheDocument();
    const bars = screen.getAllByRole('progressbar');
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute('aria-valuenow', '100'); // clipped at the display maximum
  });
});
