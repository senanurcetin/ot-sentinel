import type { LogEntry } from '@/lib/types';

/**
 * Event source IPs are unverified report fields, not attacker identities.
 * Return a deterministic most frequent critical source, ignoring blank fields.
 */
export function mostFrequentCriticalSource(logs: readonly LogEntry[]): string {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const source = log.sourceIp.trim();
    if (log.status !== 'CRITICAL' || !source) continue;
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, 'en'))[0]?.[0] ?? 'N/A';
}
