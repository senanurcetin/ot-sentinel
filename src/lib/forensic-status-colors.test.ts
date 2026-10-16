/** @jest-environment node */
import { forensicStatusColor } from '@/lib/forensic-status-colors';

describe('forensic chart semantic colors', () => {
  it('keeps secure events in the neutral theme even if the critical slice is absent', () => {
    const onlySecure = [{ name: 'Secure', value: 4 }];
    expect(onlySecure.map(row => forensicStatusColor(row.name)))
      .toEqual(['hsl(var(--chart-1))']);
  });

  it('uses the destructive palette for critical events irrespective of slice order', () => {
    expect(forensicStatusColor('Critical')).toBe('hsl(var(--destructive))');
    expect(forensicStatusColor('Secure')).toBe('hsl(var(--chart-1))');
    expect(['Secure', 'Critical'].map(forensicStatusColor))
      .toEqual(['hsl(var(--chart-1))', 'hsl(var(--destructive))']);
  });
});
