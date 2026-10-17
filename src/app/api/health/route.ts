import { NextResponse } from 'next/server';
import { version } from '../../../../package.json';
import { publicRevision } from '@/lib/release-revision';

/**
 * GET /api/health
 * Liveness probe for the container HEALTHCHECK and uptime monitors. It does no work, so it is not
 * rate-limited and does not touch the telemetry source (unlike /api/metrics).
 */
export function GET() {
  return NextResponse.json({
    status: 'ok',
    version,
    commit: publicRevision(
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.CIRCLE_SHA1 ||
      process.env.GITHUB_SHA
    ),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
