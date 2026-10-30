import { addDays, daysBetween, shortDate } from "./dates";
import type { ScheduledItem, Shifts } from "./schedule";

/**
 * Running late: when a task slips, move it and every task after it by the
 * same number of days (never past the day before the event), in code.
 */

/** How much later a late task can be moved, in days. */
export const DELAY_CHOICES = [3, 7, 14] as const;

export interface MovedItem {
  id: string;
  label: string;
  from: string;
  to: string;
}

export interface DelayResult {
  shifts: Shifts;
  /** The late task itself. */
  target: MovedItem;
  /** Later unfinished tasks and bookings that moved with it. */
  later: MovedItem[];
  /** Labels of items that could only move up to the day before the event. */
  squeezed: string[];
}

/** Can this item be marked as running late? Not when done, or already on the day before the event or later. */
export function canDelay(item: Pick<ScheduledItem, "due" | "status">, eventDate: string): boolean {
  return item.status !== "done" && item.due < addDays(eventDate, -1);
}

/**
 * The new date for a late task: "days" after its due date, or after today if
 * it is already overdue (an overdue task finishes from today, not from the past).
 * Never later than the day before the event.
 */
export function delayedDate(item: Pick<ScheduledItem, "due">, days: number, today: string, eventDate: string): string {
  const from = item.due < today ? today : item.due;
  const wanted = addDays(from, days);
  const lastDay = addDays(eventDate, -1);
  return wanted > lastDay ? lastDay : wanted;
}

/**
 * Marks a task (or vendor booking) as running late. Steps in a plan are in
 * order (venue before caterer, caterer before menu tasting), so every
 * unfinished item due after it moves by the same number of days. Items due
 * on the same day are left alone, done items never move, and nothing moves
 * onto or past the event day.
 */
export function delayItem(
  items: ScheduledItem[],
  shifts: Shifts,
  itemId: string,
  days: number,
  today: string,
  eventDate: string,
): DelayResult | null {
  const target = items.find((i) => i.id === itemId);
  if (!target || !canDelay(target, eventDate) || days <= 0) return null;
  const targetTo = delayedDate(target, days, today, eventDate);
  const gap = daysBetween(target.due, targetTo);
  if (gap <= 0) return null;
  const lastDay = addDays(eventDate, -1);
  const next: Shifts = { ...shifts, [target.id]: target.shifted + gap };
  const later: MovedItem[] = [];
  const squeezed: string[] = targetTo === lastDay ? [target.label] : [];
  const followers = items
    .filter((i) => i.id !== target.id && i.status !== "done" && i.due > target.due && i.due < eventDate)
    .sort((a, b) => a.due.localeCompare(b.due));
  for (const item of followers) {
    const wanted = addDays(item.due, gap);
    const to = wanted > lastDay ? lastDay : wanted;
    const step = daysBetween(item.due, to);
    if (to !== wanted) squeezed.push(item.label);
    if (step <= 0) continue;
    next[item.id] = item.shifted + step;
    later.push({ id: item.id, label: item.label, from: item.due, to });
  }
  return {
    shifts: next,
    target: { id: target.id, label: target.label, from: target.due, to: targetTo },
    later,
    squeezed,
  };
}

/** Plain lines for the "What changed" card after a task runs late. */
export function delayLines(result: DelayResult): string[] {
  const { target, later, squeezed } = result;
  const lines = [`“${target.label}” moved to ${shortDate(target.to)} (was ${shortDate(target.from)}).`];
  if (later.length === 0) {
    lines.push("No later tasks needed to move.");
  } else {
    const shown = later.slice(0, 4).map((m) => `${m.label} (now ${shortDate(m.to)})`);
    const more = later.length > 4 ? `, and ${later.length - 4} more` : "";
    lines.push(
      `${later.length} later ${later.length === 1 ? "task" : "tasks"} moved with it, as ${later.length === 1 ? "it depends" : "they depend"} on it: ${shown.join(", ")}${more}.`,
    );
  }
  if (squeezed.length > 0) {
    lines.push(
      `${squeezed.length === 1 ? "1 task is" : `${squeezed.length} tasks are`} now due the day before the event, so time is tight: ${squeezed.slice(0, 3).join(", ")}${squeezed.length > 3 ? "…" : ""}.`,
    );
  }
  lines.push("The event date stays the same.");
  return lines;
}

/** Keeps only shifts for items that are still in the plan. */
export function pruneShifts(shifts: Shifts | undefined, ids: string[]): Shifts {
  if (!shifts) return {};
  const keep = new Set(ids);
  return Object.fromEntries(Object.entries(shifts).filter(([id, days]) => keep.has(id) && days > 0));
}

/** "Moved 1 week later" style note for a task that was pushed back. */
export function shiftText(days: number): string {
  if (days <= 0) return "";
  if (days % 7 === 0) return `Moved ${days / 7} week${days === 7 ? "" : "s"} later`;
  return `Moved ${days} day${days === 1 ? "" : "s"} later`;
}
