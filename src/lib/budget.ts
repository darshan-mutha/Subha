import type { EventInput, Plan } from "./schemas";
import { todayIST } from "./schemas";

/** Rough minimum spend per guest (INR) below which a plan is very hard to deliver. */
const MIN_PER_GUEST: Partial<Record<EventInput["eventType"], number>> = {
  wedding: 1200,
  engagement: 800,
  "corporate-event": 800,
};
const DEFAULT_MIN_PER_GUEST = 300;

/** Formats a number as Indian Rupees, e.g. ₹12,50,000. */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * The AI's budget lines rarely add up exactly. Scale them so they sum to the
 * user's total, rounding to the nearest ₹100 and putting any remainder in the
 * largest line so the total is exact.
 */
export function normalizeBudget(lines: Plan["budget"], total: number): Plan["budget"] {
  const positive = lines.filter((l) => l.amount > 0);
  const source = positive.length > 0 ? positive : lines.map((l) => ({ ...l, amount: 1 }));
  const sum = source.reduce((acc, l) => acc + l.amount, 0);
  const scaled = source.map((l) => ({ ...l, amount: Math.round(((l.amount / sum) * total) / 100) * 100 }));
  const diff = total - scaled.reduce((acc, l) => acc + l.amount, 0);
  let largest = 0;
  scaled.forEach((l, i) => {
    if (l.amount > scaled[largest].amount) largest = i;
  });
  scaled[largest] = { ...scaled[largest], amount: scaled[largest].amount + diff };
  return scaled.sort((a, b) => b.amount - a.amount);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Checks Shubā can make without AI: budget realism and short notice. */
export function localWarnings(input: EventInput, now: Date = new Date()): string[] {
  const warnings: string[] = [];
  const perGuest = input.budget / input.guests;
  const minimum = MIN_PER_GUEST[input.eventType] ?? DEFAULT_MIN_PER_GUEST;
  if (perGuest < minimum) {
    warnings.push(
      `Your budget works out to ${formatINR(perGuest)} per guest. For this kind of event, plan for at least ${formatINR(
        minimum,
      )} per guest, or reduce the guest list.`,
    );
  }
  const days = daysBetween(todayIST(now), input.date);
  if (days < 7) {
    warnings.push(
      `Only ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"}`} to go. Book the venue and caterer first; popular vendors may already be taken.`,
    );
  }
  return warnings;
}

/** Combines local and AI warnings, removing near-duplicates. */
export function mergeWarnings(local: string[], ai: string[]): string[] {
  const seen = new Set<string>();
  return [...local, ...ai]
    .filter((w) => {
      const key = w
        .toLowerCase()
        .replace(/[^a-z]/g, "")
        .slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}
