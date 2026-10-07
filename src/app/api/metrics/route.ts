import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RateLimiter, enforceRateLimit } from '@/lib/rate-limit';
import { syntheticSource } from '@/lib/telemetry-source';

/** The dashboard polls once per second per tab; leave headroom for a few tabs. */
const limiter = new RateLimiter(180, 60_000);

const QuerySchema = z.object({
  attack: z.enum(['true', 'false']).optional(),
});

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/metrics?attack=true|false
 * Returns one scored telemetry sample from the configured source.
 */
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, limiter);
  if (limited) return limited;

  const query = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) {
    return NextResponse.json(
      { error: 'Invalid query', issues: query.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
      { status: 400, headers: NO_STORE }
    );
  }

  try {
    const data = await syntheticSource.next(query.data.attack === 'true' ? 'attack' : 'normal');
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (error) {
    // Log the cause server-side; never return internals to the client.
    console.error('metrics source failed:', error);
    return NextResponse.json({ error: 'Failed to generate metrics' }, { status: 500, headers: NO_STORE });
  }
}
