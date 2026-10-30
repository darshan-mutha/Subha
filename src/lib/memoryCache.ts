/**
 * A small in-memory cache for answers from outside services (city lookups,
 * weather). It holds at most `max` entries: when full, the oldest one is
 * dropped, so cities typed by visitors can never make it grow without limit.
 * An entry can also have its own lifetime.
 */
export function memoryCache<V>(max: number) {
  const entries = new Map<string, { value: V; expiresAt: number }>();
  return {
    /** The cached value, or undefined when there is none or it has expired. */
    get(key: string, now = Date.now()): V | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (now >= entry.expiresAt) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    /** Stores a value for `ttlMs` (for as long as the server runs when not given). */
    set(key: string, value: V, ttlMs = Infinity, now = Date.now()): void {
      entries.delete(key); // re-adding moves it to the newest end
      entries.set(key, { value, expiresAt: now + ttlMs });
      while (entries.size > max) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear(): void {
      entries.clear();
    },
    get size(): number {
      return entries.size;
    },
  };
}
