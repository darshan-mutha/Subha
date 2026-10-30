import type { EventInput, Plan } from "./schemas";
import { daysBetween, todayIST } from "./dates";
import { formatINR } from "./money";
import { scaleToTotal } from "./scale";

export { formatINR, formatShortINR } from "./money";

/** Rough minimum spend per guest (INR) below which a plan is very hard to deliver. */
const MIN_PER_GUEST: Partial<Record<EventInput["eventType"], number>> = {
  wedding: 1200,
  engagement: 800,
  "corporate-event": 800,
};
const DEFAULT_MIN_PER_GUEST = 300;

/**
 * The AI's budget lines rarely add up exactly. Scale them so they sum to the
 * user's total, rounding to the nearest ₹100 and putting any remainder in the
 * largest line so the total is exact.
 */
export function normalizeBudget(lines: Plan["budget"], total: number): Plan["budget"] {
  const positive = lines.filter((l) => l.amount > 0);
  const source = positive.length > 0 ? positive : lines.map((l) => ({ ...l, amount: 1 }));
  const amounts = scaleToTotal(
    source.map((l) => l.amount),
    total,
    { step: 100, floorAtZero: false },
  );
  return source.map((l, i) => ({ ...l, amount: amounts[i] })).sort((a, b) => b.amount - a.amount);
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

/**
 * The host sets one budget line by hand. The difference is spread across the
 * other lines in proportion to their size, so the total stays the same and the
 * host sees exactly what the change costs elsewhere. Amounts round to ₹100.
 */
export function rebalance(lines: Plan["budget"], index: number, amount: number, total: number): Plan["budget"] {
  if (index < 0 || index >= lines.length || !Number.isFinite(amount)) return lines;
  const fixed = Math.min(Math.max(0, Math.round(amount / 100) * 100), total);
  const others = lines.map((l, i) => ({ l, i })).filter(({ i }) => i !== index);
  if (others.length === 0) return lines.map((l) => ({ ...l, amount: total }));
  // When every other line is empty, share the rest equally.
  const othersSum = others.reduce((acc, { l }) => acc + l.amount, 0);
  const shares = scaleToTotal(
    others.map(({ l }) => (othersSum > 0 ? l.amount : 1)),
    total - fixed,
    { step: 100 },
  );
  const next = [...lines];
  next[index] = { ...lines[index], amount: fixed };
  others.forEach(({ l, i }, k) => (next[i] = { ...l, amount: shares[k] }));
  return next;
}
