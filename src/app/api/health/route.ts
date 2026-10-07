import { NextResponse } from 'next/server';
import { version } from '../../../../package.json';

/**
 * GET /api/health
 * Liveness probe for the container HEALTHCHECK and uptime monitors. It does no work, so it is not
 * rate-limited and does not touch the telemetry source (unlike /api/metrics).
 */
export function GET() {
  return NextResponse.json({ status: 'ok', version }, { headers: { 'Cache-Control': 'no-store' } });
}
