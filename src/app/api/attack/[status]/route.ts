import { setAttackMode, attackMode } from '@/lib/simulation-state';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { status: 'on' | 'off' } }
) {
  const status = params.status;

  if (status === 'on') {
    setAttackMode(true);
  } else if (status === 'off') {
    setAttackMode(false);
  } else {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  return NextResponse.json({ success: true, attackMode: attackMode });
}
