import { NextRequest, NextResponse } from 'next/server';
import { parseTelemetryMode } from '@/lib/metrics-query';
import { RateLimiter, enforceRateLimit } from '@/lib/rate-limit';
import { syntheticSource } from '@/lib/telemetry-source';

/** The dashboard polls once per second per tab; leave headroom for a few tabs. */
const limiter = new RateLimiter(180, 60_000);

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/metrics?attack=true|false
 * Returns one scored telemetry sample from the configured source.
 */
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, limiter);
  if (limited) return limited;

  let mode: 'normal' | 'attack';
  try {
    mode = parseTelemetryMode(req.nextUrl.searchParams);
  } catch {
    return NextResponse.json(
      { error: 'Invalid query', issues: ['Expected at most one attack=true|false parameter'] },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const data = await syntheticSource.next(mode);
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (error) {
    // Log the cause server-side; never return internals to the client.
    console.error('metrics source failed:', error);
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500, headers: NO_STORE });
  }
}
