import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter, enforceRateLimit } from '@/lib/rate-limit';
import { getFeedbackStore } from '@/lib/feedback-store';

const limiter = new RateLimiter(60, 60_000);
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/feedback/summary
 * Aggregated operator verdicts: counts, false-alarm share, and the same per sensor that drove the
 * alert. Free-text notes are never returned, because the demo has no authentication.
 */
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, limiter);
  if (limited) return limited;
  try {
    const store = await getFeedbackStore();
    return NextResponse.json(store.summary(), { headers: NO_STORE });
  } catch (error) {
    console.error('feedback summary failed:', error);
    return NextResponse.json({ error: 'Could not read feedback' }, { status: 500, headers: NO_STORE });
  }
}
