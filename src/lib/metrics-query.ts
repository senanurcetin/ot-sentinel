import type { TelemetryMode } from '@/lib/telemetry-source';

/**
 * Accept precisely the documented GET /api/metrics?attack=true|false contract.
 * Duplicate or unknown query parameters are rejected rather than silently
 * discarded by Object.fromEntries; an absent flag means normal telemetry.
 */
export function parseTelemetryMode(params: URLSearchParams): TelemetryMode {
  const keys = [...params.keys()];
  if (keys.some((key) => key !== 'attack') || params.getAll('attack').length > 1) {
    throw new Error('Unexpected or duplicated metrics query parameter');
  }

  const attack = params.get('attack');
  if (attack === null || attack === 'false') return 'normal';
  if (attack === 'true') return 'attack';
  throw new Error('attack must be true or false');
}
