/** Resolve color by event status, never by its position in filtered chart data. */
export function forensicStatusColor(status: string): string {
  if (status === 'Critical') return 'hsl(var(--destructive))';
  return 'hsl(var(--chart-1))';
}
