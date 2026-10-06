/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import raw from '@/data/batadal-case-study/results.json';
import {
  baseRate,
  fixed,
  hours,
  parseResults,
  pct,
  perAttackRows,
  results,
  summaryRows,
} from '@/lib/case-study';

describe('parseResults', () => {
  it('accepts the committed BATADAL results', () => {
    expect(() => parseResults(raw)).not.toThrow();
    expect(results.evaluations.test.attacks).toBe(7);
  });

  it.each([
    ['the synthetic smoke test', 'synthetic-smoke-test (NOT BATADAL)'],
    ['an unknown source', 'somewhere else'],
  ])('rejects results from %s', (_label, source) => {
    expect(() => parseResults({ ...raw, data_source: source })).toThrow(/not from BATADAL/);
  });

  it('rejects malformed results instead of rendering nonsense', () => {
    const broken = JSON.parse(JSON.stringify(raw));
    delete broken.evaluations.test.detectors.zscore_max.point;
    expect(() => parseResults(broken)).toThrow();
    expect(() => parseResults({})).toThrow();
  });
});

describe('formatting', () => {
  it('formats percentages, fixed numbers and hours, with n/a for missing values', () => {
    expect(pct(0.0516)).toBe('5.2 %');
    expect(pct(0.1825)).toBe('18.3 %'); // an exact tie: JS toFixed and Python format would disagree
    expect(pct(0.1824)).toBe('18.2 %');
    expect(fixed(0.3875)).toBe('0.388');
    expect(fixed(6.25, 1)).toBe('6.3');
    expect(pct(null)).toBe('n/a');
    expect(fixed(0.42674)).toBe('0.427');
    expect(fixed(6.27, 1)).toBe('6.3');
    expect(hours(1)).toBe('1');
    expect(hours(null)).toBe('n/a');
  });

  it('computes the random-guess PR-AUC as the share of attack hours', () => {
    const ev = results.evaluations.test;
    expect(baseRate(ev)).toBeCloseTo(ev.attack_hours / (ev.attack_hours + ev.attack_free_hours), 12);
  });
});

describe('view model', () => {
  it('has one summary row per evaluated detector and one per-attack row per attack', () => {
    for (const name of ['test', 'train'] as const) {
      const ev = results.evaluations[name];
      expect(summaryRows(ev)).toHaveLength(Object.keys(ev.detectors).length);
      const table = perAttackRows(ev);
      expect(table.rows).toHaveLength(ev.attacks);
      expect(table.columns).toHaveLength(Object.keys(ev.detectors).length);
      table.rows.forEach((r) => expect(r.cells).toHaveLength(table.columns.length));
    }
  });

  it('marks a missed attack as "missed", not as zero hours', () => {
    const ev = JSON.parse(JSON.stringify(results.evaluations.test));
    ev.detectors.static_limits.per_attack[0] = {
      attack: 8,
      duration_hours: 70,
      detected: false,
      hours_to_detect: null,
    };
    expect(perAttackRows(ev).rows[0].cells[0]).toBe('missed');
  });

  it('never evaluates the supervised reference on the data it was trained on', () => {
    expect(results.evaluations.train.not_evaluated).toEqual(['hist_gradient_boosting']);
    expect(Object.keys(results.evaluations.train.detectors)).not.toContain('hist_gradient_boosting');
  });
});

describe('agreement with the generated README table', () => {
  /** The README block is rendered by analysis/results_report.py; the page must show the same cells. */
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
  const block = readme.slice(
    readme.indexOf('<!-- BEGIN results:summary'),
    readme.indexOf('<!-- END results:summary')
  );

  it('shows the same cells as the test-set table in the README', () => {
    const rows = block
      .split('\n')
      .filter((l) => l.startsWith('|') && !l.includes('---') && !l.includes('Detector'))
      .slice(0, 4)
      .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
    const expected = summaryRows(results.evaluations.test).map((r) => [
      r.label,
      r.caught,
      r.expectedByChance,
      r.medianHours,
      r.alarmHoursNormal,
      r.precision,
      r.attackHoursCaught,
      r.prAuc,
    ]);
    expect(rows).toEqual(expected);
  });
});
