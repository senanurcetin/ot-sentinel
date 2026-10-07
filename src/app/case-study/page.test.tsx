import { render, screen, within } from '@testing-library/react';
import CaseStudyPage from './page';
import { results } from '@/lib/case-study';

describe('/case-study', () => {
  it('uses real headings for every section so assistive technology can navigate it', () => {
    render(<CaseStudyPage />);
    const names = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(names).toEqual(
      expect.arrayContaining([
        'Detector evaluation on BATADAL',
        'Read this first',
        expect.stringMatching(/Test set/),
        expect.stringMatching(/dataset04/),
        'Does adding time help? (protocol v3)',
        'Do the explanations point at the attacked equipment?',
        'Data drift',
        'Limitations',
      ])
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Detector evaluation on BATADAL');
  });

  it('opens with the caveats before any number', () => {
    render(<CaseStudyPage />);
    const note = screen.getByRole('note', { name: /how to read these results/i });
    expect(note).toHaveTextContent(/offline/i);
    expect(note).toHaveTextContent(/not.*what was measured/i);
    expect(note).toHaveTextContent(/anecdotes/i);
    expect(note).toHaveTextContent(`${results.data.n_features} BATADAL signals`);
  });

  it('renders the headline and secondary evaluations with their attack counts', () => {
    render(<CaseStudyPage />);
    expect(
      screen.getByRole('heading', { level: 2, name: /Test set \(attacks 8-14.*headline/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /dataset04 \(attacks 1-7.*secondary/ })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/a random guess scores a PR-AUC of about/)).toHaveLength(2);
  });

  it('shows every detector in the test summary with its generated values', () => {
    render(<CaseStudyPage />);
    const section = screen.getByRole('region', { name: /Test set/ });
    const [summary] = within(section).getAllByRole('table');
    for (const detector of Object.values(results.evaluations.test.detectors)) {
      expect(detector.event.n_events).toBe(7);
    }
    expect(within(summary).getByText('Max absolute z-score')).toBeInTheDocument();
    expect(within(summary).getAllByText('7 of 7')).toHaveLength(
      Object.keys(results.evaluations.test.detectors).length
    );
  });

  it('explains why the supervised reference is absent from the training-file table', () => {
    render(<CaseStudyPage />);
    const section = screen.getByRole('region', { name: /dataset04/ });
    expect(within(section).getByText(/not evaluated here: trained on this data/)).toBeInTheDocument();
  });

  it('lists one row per attack in each per-attack table', () => {
    render(<CaseStudyPage />);
    for (const name of [/Test set/, /dataset04/]) {
      const section = screen.getByRole('region', { name });
      const tables = within(section).getAllByRole('table');
      expect(within(tables[1]).getAllByRole('row')).toHaveLength(1 + 7); // header + 7 attacks
    }
  });

  it('shows the drift table, the limitations and a way back to the dashboard', () => {
    render(<CaseStudyPage />);
    expect(screen.getAllByText(/P_J280/).length).toBeGreaterThan(0);
    for (const item of results.limitations) expect(screen.getByText(item)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /docs\/case-study\.md/ })).toHaveAttribute(
      'href',
      expect.stringContaining('docs/case-study.md')
    );
  });

  it('states the protocol v3 decision and shows explanation accuracy for both files', () => {
    render(<CaseStudyPage />);
    expect(screen.getByText(/No temporal detector passes\./)).toBeInTheDocument();
    expect(screen.getAllByText('CUSUM (v3)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Top 3 include an attacked signal')).toHaveLength(2);
  });
});
