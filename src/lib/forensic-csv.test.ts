import { buildForensicCsv, forensicCsvFilename } from '@/lib/forensic-csv';
import type { LogEntry } from '@/lib/types';

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  id: '1',
  timestamp: '2026-01-02T03:04:05.000Z',
  sourceIp: '10.0.0.5',
  payload: 'Status check OK',
  status: 'SECURE',
  ...over,
});

describe('buildForensicCsv', () => {
  it('returns only the header for an empty log', () => {
    expect(buildForensicCsv([])).toBe('Timestamp,Status,Source IP,Payload');
  });

  it('quotes every field and normalises the timestamp to ISO 8601', () => {
    const [, row] = buildForensicCsv([entry({ timestamp: '2026-01-02T05:04:05+02:00' })]).split('\n');
    expect(row).toBe('"2026-01-02T03:04:05.000Z","SECURE","10.0.0.5","Status check OK"');
  });

  it('escapes embedded quotes and keeps commas and newlines inside one quoted cell', () => {
    const csv = buildForensicCsv([entry({ payload: 'said "stop", then\nleft' })]);
    expect(csv).toContain('"said ""stop"", then\nleft"');
  });

  it.each(['=SUM(A1)', '+1+1', '-2', '@cmd'])('neutralises formula-like payload %s', (payload) => {
    const csv = buildForensicCsv([entry({ payload })]);
    expect(csv).toContain(`"'${payload}"`);
  });

  it('does not alter a hyphen that is not the first character', () => {
    expect(buildForensicCsv([entry({ payload: 'risk 5 - ok' })])).toContain('"risk 5 - ok"');
  });

  it('writes one row per entry in the given order', () => {
    const csv = buildForensicCsv([entry({ sourceIp: '1.1.1.1' }), entry({ sourceIp: '2.2.2.2' })]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('1.1.1.1');
    expect(lines[2]).toContain('2.2.2.2');
  });
});

describe('forensicCsvFilename', () => {
  it('embeds the timestamp', () => {
    expect(forensicCsvFilename(new Date('2026-01-02T03:04:05.000Z'))).toBe(
      'otsentinel-forensic-report-2026-01-02T03:04:05.000Z.csv'
    );
  });
});
