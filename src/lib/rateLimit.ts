/**
 * Simple fixed-window rate limiter kept in memory. Protects the AI quota from
 * abuse. On serverless hosts each instance keeps its own window, which is an
 * acceptable trade-off for this app's scale.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
      }
      return { allowed: true, retryAfterSec: 0 };
    }
    if (entry.count >= limit) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    return { allowed: true, retryAfterSec: 0 };
  };
}

export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "anonymous";
}
