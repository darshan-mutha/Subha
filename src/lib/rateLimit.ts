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

/**
 * The visitor's IP. On Vercel, x-real-ip and the first x-forwarded-for entry
 * are set by the platform, so a visitor cannot pick their own key.
 */
export function clientKey(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return real || forwarded || "anonymous";
}

/**
 * Checks several limits at once (e.g. per minute and per day). A request is
 * only counted when every limit allows it, so a blocked request costs nothing.
 */
export function combineLimiters(...limits: Array<{ limit: number; windowMs: number }>) {
  const windows = limits.map(({ limit, windowMs }) => ({
    limit,
    windowMs,
    hits: new Map<string, { count: number; resetAt: number }>(),
  }));
  return function check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSec: number } {
    for (const w of windows) {
      const entry = w.hits.get(key);
      if (entry && now < entry.resetAt && entry.count >= w.limit) {
        return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
      }
    }
    for (const w of windows) {
      const entry = w.hits.get(key);
      if (!entry || now >= entry.resetAt) {
        w.hits.set(key, { count: 1, resetAt: now + w.windowMs });
        if (w.hits.size > 5000) for (const [k, v] of w.hits) if (now >= v.resetAt) w.hits.delete(k);
      } else entry.count++;
    }
    return { allowed: true, retryAfterSec: 0 };
  };
}
