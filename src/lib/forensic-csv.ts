import type { LogEntry } from '@/lib/types';

const HEADERS = ['Timestamp', 'Status', 'Source IP', 'Payload'] as const;

/**
 * Spreadsheet apps execute cells that start with these characters as formulas. Log payloads are
 * generated server-side today, but the export should stay safe if they ever carry untrusted text
 * (OWASP "CSV injection"), so such cells are prefixed with a single quote.
 */
// Some spreadsheet importers skip leading whitespace / invisible characters
// before evaluating a formula, so check the first non-whitespace character.
// Treat control, zero-width and bidi formatting marks as potentially ignored
// prefixes. An importer may interpret the next character as a formula.
const FORMULA_PREFIX = /^[\s\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069]*[=+\-@]/u;
const CONTROL_PREFIX = /^[\t\r\n]/;

function escapeCell(value: unknown): string {
  let text = String(value ?? '');
  if (FORMULA_PREFIX.test(text) || CONTROL_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Preserve malformed source timestamps as labelled evidence; never invent a date or
// throw away the whole forensic report because a log row is malformed.
const EXPLICIT_ZONE_TIMESTAMP = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$/;
function reportTimestamp(raw: string): string {
  const timestamp = typeof raw === 'string' ? raw : String(raw ?? '');
  const parsed = new Date(timestamp);
  if (!EXPLICIT_ZONE_TIMESTAMP.test(timestamp) || Number.isNaN(parsed.getTime())) {
    return `Invalid timestamp: ${timestamp}`;
  }
  return parsed.toISOString();
}

/** Build the forensic report CSV: a header row followed by one fully quoted row per log entry. */
export function buildForensicCsv(logs: LogEntry[]): string {
  const rows = logs.map((log) =>
    [reportTimestamp(log.timestamp), log.status, log.sourceIp, log.payload]
      .map(escapeCell)
      .join(',')
  );
  return [HEADERS.join(','), ...rows].join('\n');
}

export function forensicCsvFilename(now: Date = new Date()): string {
  // Colons in an ISO timestamp are illegal in Windows filenames.
  return `otsentinel-forensic-report-${now.toISOString().replace(/:/g, '-')}.csv`;
}
