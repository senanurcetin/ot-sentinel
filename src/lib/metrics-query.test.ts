import { parseTelemetryMode } from '@/lib/metrics-query';

describe('strict metrics query handling', () => {
  it('preserves the documented normal and attack modes', () => {
    expect(parseTelemetryMode(new URLSearchParams())).toBe('normal');
    expect(parseTelemetryMode(new URLSearchParams('attack=false'))).toBe('normal');
    expect(parseTelemetryMode(new URLSearchParams('attack=true'))).toBe('attack');
  });

  it.each([
    'attack=TRUE', 'attack=', 'attack=1',
    'attack=true&attack=false',
    'attack=true&attack=true',
    'attack=true&operator=admin',
    'mode=attack',
    'attack=false&debug=1',
  ])('rejects ambiguous or unsupported query %s', (query) => {
    expect(() => parseTelemetryMode(new URLSearchParams(query))).toThrow();
  });
});
