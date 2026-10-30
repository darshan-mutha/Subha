import type { z } from "zod";

/**
 * Safe access to this browser's localStorage.
 *
 * Storage can be missing, full or blocked (private mode, strict settings), and
 * saved data can be old or edited by hand. Everything kept here is optional, so
 * these helpers never throw: reads give null and writes report false instead.
 */

/** Reads a saved JSON value and checks it against `schema`; null when missing, unreadable or invalid. */
export function readJson<S extends z.ZodType>(key: string, schema: S): z.output<S> | null {
  const raw = readText(key);
  if (raw === null) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Saves a value as JSON; false when storage is unavailable or full. */
export function writeJson(key: string, value: unknown): boolean {
  return writeText(key, JSON.stringify(value));
}

/** Reads a saved plain string; null when missing or storage is unavailable. */
export function readText(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Saves a plain string; false when storage is unavailable or full. */
export function writeText(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Removes a saved value, ignoring unavailable storage. */
export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to remove */
  }
}
