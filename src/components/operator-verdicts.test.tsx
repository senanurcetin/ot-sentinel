import { render, screen } from '@testing-library/react';
import OperatorVerdicts from '@/components/operator-verdicts';
import type { FeedbackSummary } from '@/lib/feedback-store';

const respond = (body: unknown, ok = true) => {
  global.fetch = jest.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as never;
};

const summary = (over: Partial<FeedbackSummary> = {}): FeedbackSummary => ({
  provenance: {
    source: 'self_reported_demo_verdicts',
    independently_verified: false,
    detector_performance_metric: false,
  },
  storage: 'memory',
  total: 3,
  confirmed_threat: 1,
  false_alarm: 2,
  false_alarm_share: 2 / 3,
  by_top_sensor: [{ sensor: 'temp', total: 2, false_alarm: 2 }],
  recent_24h: { total: 2, confirmed_threat: 1, false_alarm: 1, false_alarm_share: 0.5 },
  ...over,
});

describe('OperatorVerdicts', () => {
  it('shows the counts, the false-alarm share, where they are stored and the per-sensor breakdown', async () => {
    respond(summary());
    render(<OperatorVerdicts />);
    expect(await screen.findByText(/1 marked confirmed threat, 2 marked false alarms/)).toBeInTheDocument();
    expect(screen.getByText(/Self-reported demo verdicts:/)).toBeInTheDocument();
    expect(screen.getByText(/67 % of submitted verdicts marked false alarm/)).toBeInTheDocument();
    expect(screen.getByText(/2 submissions, 1 marked false alarm \(50 %\)/)).toBeInTheDocument();
    expect(screen.getByText(/not detector precision or measured false-positive rates/)).toBeInTheDocument();
    expect(screen.getByText(/kept in memory and lost on restart/)).toBeInTheDocument();
    expect(screen.getByText(/temp 2 of 2/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/feedback/summary');
  });

  it('says when verdicts are persisted in SQLite', async () => {
    respond(summary({ storage: 'sqlite', total: 1, confirmed_threat: 1, false_alarm: 0, false_alarm_share: 0, by_top_sensor: [] }));
    render(<OperatorVerdicts />);
    expect(await screen.findByText(/stored in SQLite/)).toBeInTheDocument();
    expect(screen.queryByText(/False alarms by the sensor/)).not.toBeInTheDocument();
  });

  it('reports an empty recent window without inventing recent performance', async () => {
    respond(summary({ recent_24h: { total: 0, confirmed_threat: 0, false_alarm: 0, false_alarm_share: null } }));
    render(<OperatorVerdicts />);
    expect(await screen.findByText(/Past 24 hours:/)).toBeInTheDocument();
    expect(screen.getByText(/no submitted verdicts/)).toBeInTheDocument();
  });

  it('handles an empty store', async () => {
    respond(summary({ total: 0, confirmed_threat: 0, false_alarm: 0, false_alarm_share: null, by_top_sensor: [] }));
    render(<OperatorVerdicts />);
    expect(await screen.findByText('No operator verdicts recorded yet.')).toBeInTheDocument();
  });

  it('degrades to a notice when the summary cannot be loaded', async () => {
    respond({}, false);
    render(<OperatorVerdicts />);
    expect(await screen.findByText('Operator verdicts are unavailable.')).toBeInTheDocument();
  });
});
