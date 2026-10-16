/** @jest-environment node */
import { mostFrequentCriticalSource } from '@/lib/forensic-source-summary';
import type { LogEntry } from '@/lib/types';

const log = (sourceIp: string, status: LogEntry['status']): LogEntry => ({
  id: sourceIp,
  timestamp: '2026-10-17T00:00:00Z',
  sourceIp,
  status,
  payload: 'observation',
});

describe('critical source IP summary', () => {
  it('uses only critical source observations and never attributes secure events', () => {
    const records = [
      log('203.0.113.10', 'CRITICAL'),
      log('203.0.113.10', 'CRITICAL'),
      log('198.51.100.8', 'CRITICAL'),
      ...Array.from({ length: 10 }, () => log('198.51.100.8', 'SECURE')),
    ];
    expect(mostFrequentCriticalSource(records)).toBe('203.0.113.10');
  });

  it('uses a stable IP ordering when counts tie and does not mutate logs', () => {
    const records = [
      log('203.0.113.20', 'CRITICAL'),
      log('203.0.113.10', 'CRITICAL'),
    ];
    const original = structuredClone(records);
    expect(mostFrequentCriticalSource(records)).toBe('203.0.113.10');
    expect(mostFrequentCriticalSource([...records].reverse())).toBe('203.0.113.10');
    expect(records).toEqual(original);
  });

  it('reports missing observations as unavailable instead of inventing an attacker', () => {
    expect(mostFrequentCriticalSource([])).toBe('N/A');
    expect(mostFrequentCriticalSource([log(' ', 'CRITICAL'), log('203.0.113.10', 'SECURE')])).toBe('N/A');
  });
});
