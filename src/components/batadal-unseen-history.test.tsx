import { fireEvent, render, screen, within } from '@testing-library/react';
import { BatadalHistoricalWorkbench } from '@/components/batadal-historical-workbench';

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

describe('verified 2017 test period hourly workbench', () => {
 it('clearly distinguishes held-out 2017 readings and source-local time', () => {
  render(<BatadalHistoricalWorkbench dataset="test" />);
  expect(screen.getByRole('heading',{name:'Verified 2017 hourly sensor history'})).toBeInTheDocument();
  expect(screen.getByText(/unseen 2017 test ZIP/)).toBeInTheDocument();
  expect(screen.getByText(/source-local, not asserted UTC/)).toBeInTheDocument();
  expect(screen.getByText(/original unlabelled test ZIP/)).toBeInTheDocument();
  expect(screen.getByText(/No training, threshold fitting, or new/)).toBeInTheDocument();
  const chart=screen.getByRole('region',{name:'Real historical measurement chart'});
  expect(within(chart).getByText(/70 \/ 94 in published attack interval/)).toBeInTheDocument();
  expect(screen.getByText(/94 contiguous hourly rows/)).toBeInTheDocument();
 });
 it('switches to attack 14 and source-measured physical units',()=>{
  render(<BatadalHistoricalWorkbench dataset="test" />);
  fireEvent.change(screen.getByRole('combobox',{name:'Published attack interval'}),{target:{value:'14'}});
  const chart=screen.getByRole('region',{name:'Real historical measurement chart'});
  expect(within(chart).getByText(/30 \/ 54 in published attack interval/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox',{name:'Measurement category'}),{target:{value:'pressures'}});
  expect(screen.getByRole('combobox',{name:'Recorded measurement'})).toHaveValue('P_J280');
  expect(screen.getByText('Source measurements: P_J280')).toBeInTheDocument();
  expect(screen.getByText('Measured value (m)')).toBeInTheDocument();
 });
});
