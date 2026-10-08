import { render, screen } from '@testing-library/react';
import OperatorVerdicts from '@/components/operator-verdicts';
import type { FeedbackSummary } from '@/lib/feedback-store';

const respond = (body: unknown, ok = true) => {
  global.fetch = jest.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as never;
};

const summary = (over: Partial<FeedbackSummary> = {}): FeedbackSummary => ({
  storage: 'memory',
  total: 3,
  confirmed_threat: 1,
  false_alarm: 2,
  false_alarm_share: 2 / 3,
  by_top_sensor: [{ sensor: 'temp', total: 2, false_alarm: 2 }],
  ...over,
});

describe('OperatorVerdicts', () => {
  it('shows the counts, the false-alarm share, where they are stored and the per-sensor breakdown', async () => {
    respond(summary());
    render(<OperatorVerdicts />);
    expect(await screen.findByText(/1 confirmed\s+threat, 2 false alarms/)).toBeInTheDocument();
    expect(screen.getByText(/67 % false alarms/)).toBeInTheDocument();
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
