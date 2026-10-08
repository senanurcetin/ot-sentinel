import { NextResponse, type NextRequest } from 'next/server';
import { credentialsMatch, parseAuthConfig, parseBasicHeader } from '@/lib/basic-auth';
import { clientKey, RateLimiter } from '@/lib/rate-limit';

/**
 * Next.js 16 proxy (formerly middleware). It does one thing: when `DEMO_BASIC_AUTH` is set, every
 * page, API route and server action requires HTTP Basic credentials. When it is not set, requests
 * pass through untouched and the demo is open.
 */

export const REALM = 'OT-Sentinel demo';

// Wrong guesses per client per minute before further attempts are refused without checking.
// Requests that send no credentials (the browser's first visit) do not count.
export const failedAttempts = new RateLimiter(10, 60_000);

function deny(status: number, message: string, headers: Record<string, string> = {}) {
  return new NextResponse(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

const challenge = { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` };

export async function proxy(request: NextRequest) {
  // Read per request, not at build time, so one image can run open or protected.
  const config = parseAuthConfig(process.env.DEMO_BASIC_AUTH);
  if (config.mode === 'open') return NextResponse.next();
  if (config.mode === 'misconfigured') {
    console.error(
      'DEMO_BASIC_AUTH is set but invalid: expected "user:password" with a password of at least 12 characters.'
    );
    return deny(503, 'Demo authentication is misconfigured.');
  }

  const key = clientKey(request.headers);
  if (failedAttempts.isLimited(key)) {
    return deny(429, 'Too many failed sign-in attempts. Try again in a minute.', { 'Retry-After': '60' });
  }

  const given = parseBasicHeader(request.headers.get('authorization'));
  if (given && (await credentialsMatch(given, config.credentials))) return NextResponse.next();
  if (given) failedAttempts.check(key);
  return deny(401, 'Authentication required.', challenge);
}

export const config = {
  // Everything except the container health probe and build assets, which hold no data.
  matcher: ['/((?!api/health|_next/static|_next/image|favicon\\.ico).*)'],
};
