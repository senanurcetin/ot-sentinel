import { NextRequest, NextResponse } from 'next/server';
import { AlertFeedbackSchema, type AlertFeedback } from '@/lib/types';

/**
 * Operator verdicts on raised alerts ("confirmed threat" / "false alarm").
 *
 * Demo-grade by design: verdicts live in a capped in-memory buffer and are lost on restart.
 * A real deployment would persist them and feed false-alarm rates back into threshold tuning.
 */
const MAX_STORED = 200;
const store: (AlertFeedback & { received_at: string })[] = [];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const parsed = AlertFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid feedback', issues: parsed.error.issues.map((i) => i.message) },
      { status: 422 }
    );
  }

  store.push({ ...parsed.data, received_at: new Date().toISOString() });
  if (store.length > MAX_STORED) store.shift();
  return NextResponse.json({ received: true, stored: store.length }, { status: 202 });
}
