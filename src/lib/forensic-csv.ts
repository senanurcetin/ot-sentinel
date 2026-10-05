import type { LogEntry } from '@/lib/types';

const HEADERS = ['Timestamp', 'Status', 'Source IP', 'Payload'] as const;

/**
 * Spreadsheet apps execute cells that start with these characters as formulas. Log payloads are
 * generated server-side today, but the export should stay safe if they ever carry untrusted text
 * (OWASP "CSV injection"), so such cells are prefixed with a single quote.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: unknown): string {
  let text = String(value ?? '');
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Build the forensic report CSV: a header row followed by one fully quoted row per log entry. */
export function buildForensicCsv(logs: LogEntry[]): string {
  const rows = logs.map((log) =>
    [new Date(log.timestamp).toISOString(), log.status, log.sourceIp, log.payload]
      .map(escapeCell)
      .join(',')
  );
  return [HEADERS.join(','), ...rows].join('\n');
}

export function forensicCsvFilename(now: Date = new Date()): string {
  return `otsentinel-forensic-report-${now.toISOString()}.csv`;
}
