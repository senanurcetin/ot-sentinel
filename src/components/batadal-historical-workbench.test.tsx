import { fireEvent, render, screen, within } from '@testing-library/react';
import { BatadalHistoricalWorkbench } from '@/components/batadal-historical-workbench';

// Chart internals depend on browser-only dimensions; E2E checks real Chromium
// rendering, while React tests focus on selectors, labels and measured rows.
jest.mock('recharts', () => ({
  CartesianGrid: () => null,
  Line: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReferenceArea: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
jest.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

describe('published BATADAL 2016 historical graph', () => {
  it('identifies genuine source and avoids claiming UTC or unseen 2017 test curves', () => {
    render(<BatadalHistoricalWorkbench />);
    expect(screen.getByRole('heading', { name: 'Verified 2016 hourly sensor history' })).toBeInTheDocument();
    expect(screen.getByText(/43 real channels/i)).toBeInTheDocument();
    expect(screen.getByText(/source-local, not asserted UTC/i)).toBeInTheDocument();
    expect(screen.getByText(/verified 2017 original test measurements/i)).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Real historical measurement chart' });
    expect(within(region).getByText(/50 \/ 74 in published attack interval/i)).toBeInTheDocument();
    expect(within(region).getByText(/Source measurements: L_T7/i)).toBeInTheDocument();
  });

  it('switches to the source-measured signal and respects physical units', () => {
    render(<BatadalHistoricalWorkbench />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Measurement category' }),
      { target: { value: 'flows' } });
    const signals = screen.getByRole('combobox', { name: 'Recorded measurement' });
    expect(signals).toHaveValue('F_PU1');
    expect(screen.getByText('Source measurements: F_PU1')).toBeInTheDocument();
    expect(screen.getByText('Measured value (LPS)')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Measurement category' }),
      { target: { value: 'states' } });
    expect(signals).toHaveValue('S_PU1');
    expect(screen.getByText('Measured value (on/off)')).toBeInTheDocument();
  });

  it('reselects a different attack and displays exactly its recorded window', () => {
    render(<BatadalHistoricalWorkbench />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Published attack interval' }),
      { target: { value: '7' } });
    const region = screen.getByRole('region', { name: 'Real historical measurement chart' });
    expect(within(region).getByText(/110 \/ 134 in published attack interval/i)).toBeInTheDocument();
    expect(screen.getByText(/134 contiguous hourly rows/)).toBeInTheDocument();
    expect(screen.getByText('110 hours')).toBeInTheDocument();
    expect(screen.getByText('2016-12-14T03:00:00')).toBeInTheDocument();
  });
});
