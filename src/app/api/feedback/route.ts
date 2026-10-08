import { NextRequest, NextResponse } from 'next/server';
import { AlertFeedbackSchema } from '@/lib/types';
import { RateLimiter, enforceRateLimit } from '@/lib/rate-limit';
import { getFeedbackStore } from '@/lib/feedback-store';

/**
 * Operator verdicts on raised alerts ("confirmed threat" / "false alarm").
 *
 * Stored in SQLite when FEEDBACK_DB_PATH is set, otherwise in a capped in-memory buffer that is
 * lost on restart (see src/lib/feedback-store.ts). Aggregates: GET /api/feedback/summary.
 */
const MAX_BODY_BYTES = 4096;
const limiter = new RateLimiter(30, 60_000);
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, limiter);
  if (limited) return limited;

  // Cheap rejection first (declared length), then the real check on what was actually sent.
  const declared = Number(req.headers.get('content-length') ?? 0);
  const text = declared > MAX_BODY_BYTES ? null : await req.text();
  if (text === null || Buffer.byteLength(text) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Body too large' }, { status: 413, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400, headers: NO_STORE });
  }

  const parsed = AlertFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid feedback', issues: parsed.error.issues.map((i) => i.message) },
      { status: 422, headers: NO_STORE }
    );
  }

  try {
    const store = await getFeedbackStore();
    store.add({ ...parsed.data, received_at: new Date().toISOString() });
    return NextResponse.json({ received: true, storage: store.kind }, { status: 202, headers: NO_STORE });
  } catch (error) {
    // Log the cause server-side; never return internals (paths, SQL) to the client.
    console.error('feedback store failed:', error);
    return NextResponse.json({ error: 'Could not store feedback' }, { status: 500, headers: NO_STORE });
  }
}
