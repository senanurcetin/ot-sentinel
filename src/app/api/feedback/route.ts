import { NextRequest, NextResponse } from 'next/server';
import { AlertFeedbackSchema, type AlertFeedback } from '@/lib/types';
import { RateLimiter, enforceRateLimit } from '@/lib/rate-limit';

/**
 * Operator verdicts on raised alerts ("confirmed threat" / "false alarm").
 *
 * Demo-grade by design: verdicts live in a capped in-memory buffer and are lost on restart.
 * A real deployment would persist them and feed false-alarm rates back into threshold tuning.
 */
const MAX_STORED = 200;
const MAX_BODY_BYTES = 4096;
const store: (AlertFeedback & { received_at: string })[] = [];
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

  store.push({ ...parsed.data, received_at: new Date().toISOString() });
  if (store.length > MAX_STORED) store.shift();
  return NextResponse.json({ received: true, stored: store.length }, { status: 202, headers: NO_STORE });
}
