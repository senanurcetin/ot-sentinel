import { fireEvent, render, screen, within } from '@testing-library/react';
import { BatadalEvidenceExplorer } from '@/components/batadal-evidence-explorer';

describe('interactive BATADAL evidence explorer', () => {
  it('renders a clearly labelled real offline evaluation, not a live SCADA stream', () => {
    render(<BatadalEvidenceExplorer />);
    expect(screen.getByRole('heading', { name: 'BATADAL signal evidence explorer' })).toBeInTheDocument();
    expect(screen.getByText('43 of 43 signals shown')).toBeInTheDocument();
    expect(screen.getByText(/not a live SCADA feed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2016 verified hourly history' }))
      .toHaveAttribute('href', '/batadal-history');
    expect(screen.getByRole('link', { name: '2017 verified holdout history' }))
      .toHaveAttribute('href', '/batadal-test-history');
    expect(screen.getByText(/not complete\s+dataset timelines/i)).toBeInTheDocument();
    const attackSection = screen.getByRole('region', { name: 'Published attack descriptions' });
    const rows = within(attackSection).getAllByRole('row');
    expect(rows).toHaveLength(8); // table heading plus seven measured attacks
    expect(within(attackSection).getByText('#8')).toBeInTheDocument();
    expect(within(attackSection).getByText('#14')).toBeInTheDocument();
    const signalSection = screen.getByRole('region', { name: 'Signal inventory' });
    expect(within(signalSection).getAllByRole('row')).toHaveLength(44);
  });

  it('filters by feature category with published drift nulls rather than inventing numbers', () => {
    render(<BatadalEvidenceExplorer />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Signal category' }), {
      target: { value: 'tanks' },
    });
    expect(screen.getByText('7 of 43 signals shown')).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Signal inventory' });
    expect(within(section).getByText('L_T1')).toBeInTheDocument();
    expect(within(section).queryByText('P_J280')).not.toBeInTheDocument();
    expect(within(section).getAllByText('Not among reported top features').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('combobox', { name: 'Signal category' }), {
      target: { value: 'pressure' },
    });
    expect(within(section).getByText('P_J280')).toBeInTheDocument();
    expect(within(section).getByText('17.8%')).toBeInTheDocument();
  });

  it('switches evaluation sets and forbids applying the supervised reference to training data', () => {
    render(<BatadalEvidenceExplorer />);
    const detector = screen.getByRole('combobox', { name: 'Evaluated detector' });
    fireEvent.change(detector, { target: { value: 'hist_gradient_boosting' } });
    expect(detector).toHaveValue('hist_gradient_boosting');
    fireEvent.change(screen.getByRole('combobox', { name: 'Evaluation set' }), {
      target: { value: 'train' },
    });
    expect(detector).toHaveValue('zscore_max');
    expect(within(detector).queryByRole('option', { name: /Gradient boosting/i })).not.toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Published attack descriptions' });
    expect(within(section).getByText('#1')).toBeInTheDocument();
    expect(within(section).getByText('#7')).toBeInTheDocument();
    expect(within(section).queryByText('#14')).not.toBeInTheDocument();
  });
});
