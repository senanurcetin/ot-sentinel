import { NextResponse, type NextRequest } from 'next/server';

/**
 * Fixed-window, in-memory rate limiter.
 *
 * Limits are PER SERVER INSTANCE: on a multi-instance or serverless deployment each instance
 * counts separately, so this is a cost/abuse brake, not a security boundary. Put a shared
 * limiter (edge/WAF/Redis) in front for anything beyond a demo.
 */
type Window = { count: number; resetAt: number };

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export class RateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000
  ) {}

  check(key: string): RateLimitResult {
    const t = this.now();
    let w = this.windows.get(key);
    if (!w || w.resetAt <= t) {
      if (this.windows.size >= this.maxKeys) this.evictExpired(t);
      // Still full of live windows: refuse to track more keys instead of growing without bound.
      if (this.windows.size >= this.maxKeys) {
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(this.windowMs / 1000) };
      }
      w = { count: 0, resetAt: t + this.windowMs };
      this.windows.set(key, w);
    }
    w.count += 1;
    return {
      allowed: w.count <= this.limit,
      remaining: Math.max(0, this.limit - w.count),
      retryAfterSeconds: Math.max(1, Math.ceil((w.resetAt - t) / 1000)),
    };
  }

  /** True when `key` has used up its window, without counting this call. */
  isLimited(key: string): boolean {
    const w = this.windows.get(key);
    return !!w && w.resetAt > this.now() && w.count >= this.limit;
  }

  private evictExpired(t: number) {
    for (const [key, w] of this.windows) if (w.resetAt <= t) this.windows.delete(key);
  }
}

/**
 * Best-effort client identifier. `x-forwarded-for` is only trustworthy behind a proxy that sets
 * it; a direct client can spoof it to dodge the limit (see docs/threat-model.md).
 */
export function clientKey(headers: Pick<Headers, 'get'>): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function enforceRateLimit(req: NextRequest, limiter: RateLimiter): NextResponse | null {
  const result = limiter.check(clientKey(req.headers));
  if (result.allowed) return null;
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfterSeconds), 'Cache-Control': 'no-store' },
    }
  );
}
