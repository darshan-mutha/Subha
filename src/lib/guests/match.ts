import { daysBetween } from "../dates";
import type { Reply } from "../rsvp";
import { REMIND_AFTER_DAYS, type GuestEntry, type GuestList } from "./entry";

/**
 * Matching replies from the guest link to the list (by phone number, or else
 * by name), and what that makes each entry's status.
 */

const lastTen = (phone: string) => phone.replace(/\D/g, "").slice(-10);
const FILLER = new Set([
  "family",
  "ji",
  "the",
  "and",
  "aur",
  "mr",
  "mrs",
  "ms",
  "dr",
  "shri",
  "smt",
  "uncle",
  "aunty",
  "auntie",
]);
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(" ");
}

/** Pairs each list entry with at most one reply: same phone first, then same or contained name. */
export function matchReplies(entries: GuestList, replies: Reply[]): Map<string, Reply> {
  const out = new Map<string, Reply>();
  const used = new Set<string>();
  const take = (entry: GuestEntry, reply: Reply) => {
    out.set(entry.id, reply);
    used.add(reply.id);
  };
  // Newest reply first, so a changed answer wins.
  const sorted = [...replies].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const entry of entries) {
    const phone = lastTen(entry.phone);
    if (phone.length < 10) continue;
    const reply = sorted.find((r) => !used.has(r.id) && lastTen(r.phone) === phone);
    if (reply) take(entry, reply);
  }
  for (const entry of entries) {
    if (out.has(entry.id)) continue;
    const key = nameKey(entry.name);
    if (key.length < 3) continue;
    const reply =
      sorted.find((r) => !used.has(r.id) && nameKey(r.name) === key) ??
      sorted.find((r) => {
        if (used.has(r.id)) return false;
        const other = nameKey(r.name);
        return other.length >= 4 && (key.includes(other) || other.includes(key));
      });
    if (reply) take(entry, reply);
  }
  return out;
}

export type EntryStatus = "not-invited" | "invited" | "coming" | "maybe" | "no";
export const STATUS_LABELS: Record<EntryStatus, string> = {
  "not-invited": "Not invited",
  invited: "Invited · no reply",
  coming: "Coming",
  maybe: "Maybe",
  no: "Can't come",
};

export function entryStatus(entry: GuestEntry, reply: Reply | undefined): EntryStatus {
  if (reply) return reply.coming === "yes" ? "coming" : reply.coming;
  return entry.invitedAt ? "invited" : "not-invited";
}

/** Invited, no reply yet, and a week has passed since the invitation or the last reminder. */
export function needsReminder(entry: GuestEntry, reply: Reply | undefined, today: string): boolean {
  if (reply || !entry.invitedAt) return false;
  const last = entry.remindedAt && entry.remindedAt > entry.invitedAt ? entry.remindedAt : entry.invitedAt;
  return daysBetween(last, today) >= REMIND_AFTER_DAYS;
}
