/** The answer to "may this request go ahead?". */
export interface RateResult {
  allowed: boolean;
  retryAfterSec: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

/** Above this many visitors, expired entries are cleared so memory stays small. */
const CLEANUP_AT = 5000;

/** One fixed time window of request counts per visitor. */
function createWindow(limit: number, windowMs: number) {
  const hits = new Map<string, Entry>();

  function removeExpired(now: number) {
    for (const [key, entry] of hits) {
      if (now >= entry.resetAt) hits.delete(key);
    }
  }

  return {
    /** Seconds until the visitor may try again, or 0 if they are under the limit. */
    waitSec(key: string, now: number): number {
      const entry = hits.get(key);
      if (!entry || now >= entry.resetAt || entry.count < limit) return 0;
      return Math.ceil((entry.resetAt - now) / 1000);
    },
    /** Counts one request, starting a fresh window when the old one has ended. */
    count(key: string, now: number): void {
      const entry = hits.get(key);
      if (entry && now < entry.resetAt) {
        entry.count++;
        return;
      }
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > CLEANUP_AT) removeExpired(now);
    },
  };
}

/**
 * Checks several limits at once (e.g. per minute and per day). A request is
 * only counted when every limit allows it, so a blocked request costs nothing.
 */
export function combineLimiters(...limits: Array<{ limit: number; windowMs: number }>) {
  const windows = limits.map(({ limit, windowMs }) => createWindow(limit, windowMs));
  return function check(key: string, now: number = Date.now()): RateResult {
    for (const window of windows) {
      const wait = window.waitSec(key, now);
      if (wait > 0) return { allowed: false, retryAfterSec: wait };
    }
    for (const window of windows) window.count(key, now);
    return { allowed: true, retryAfterSec: 0 };
  };
}

/**
 * Simple fixed-window rate limiter kept in memory. Protects the AI quota from
 * abuse. On serverless hosts each instance keeps its own window, which is an
 * acceptable trade-off for this app's scale.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  return combineLimiters({ limit, windowMs });
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
