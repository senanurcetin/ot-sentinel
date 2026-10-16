import { NextResponse, type NextRequest } from 'next/server';
import {
  decodeDemoBasicAuth, demoCredentialsMatch, DemoFailureGate, parseDemoAuthConfig,
} from '@/lib/demo-auth';

const REALM = 'OT-Sentinel synthetic demo';
const CHALLENGE = { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` };
const NO_STORE = {
  'Cache-Control': 'no-store',
  'Content-Type': 'text/plain; charset=utf-8',
};

export const demoFailureGate = new DemoFailureGate();

function deny(status: number, message: string, headers: Record<string, string> = {}) {
  return new NextResponse(message, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Opt-in shared HTTP Basic gate on a synthetic demonstration only.
 * It never derives rate-limit keys from spoofable x-forwarded-for/x-real-ip.
 * Do not interpret this as a replacement for HTTPS, deployment SSO/WAF,
 * user-level authorization, or trusted OT identity.
 */
export async function proxy(request: NextRequest) {
  const config = parseDemoAuthConfig(process.env.DEMO_BASIC_AUTH);
  if (config.mode === 'open') return NextResponse.next();
  if (config.mode === 'misconfigured') {
    return deny(503, 'Demo access configuration invalid.');
  }
  if (demoFailureGate.isBlocked()) {
    return deny(429, 'Demo sign-in temporarily limited.', { 'Retry-After': '60' });
  }
  const credentials = decodeDemoBasicAuth(request.headers.get('authorization'));
  if (credentials && await demoCredentialsMatch(credentials, config.credentials)) {
    return NextResponse.next();
  }
  // Only malformed/present credentials count; first browser challenge does not.
  if (request.headers.has('authorization')) demoFailureGate.recordFailure();
  return deny(401, 'Demo authentication required.', CHALLENGE);
}

// Keep health checks and static runtime assets accessible. Protect every
// application page/API and the server-action POST (which is verified again).
export const config = {
  matcher: ['/((?!api/health(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)'],
};
