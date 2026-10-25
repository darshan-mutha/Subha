import type { Plan, Priority } from "./schemas";
import type { Assignments, Done, PlanItem } from "./team";
import { planStructure } from "./team";

/**
 * Turns the plan's "8 weeks before"-style timeline into real dates, so Shubā
 * can show what is overdue, what is due this week and what to do next.
 * All dates are YYYY-MM-DD strings in India time.
 */

const DAY_MS = 86_400_000;
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const DUE_SOON_DAYS = 7;

export type Status = "done" | "overdue" | "due-soon" | "upcoming";

export interface ScheduledItem extends PlanItem {
  priority: Priority;
  due: string;
  status: Status;
  /** Big moments that fill a rangoli petal when done. */
  milestone: boolean;
  /** Days this item was pushed back because it, or a task before it, ran late. */
  shifted: number;
}

/** Extra days per item id, added when a task runs late. */
export type Shifts = Record<string, number>;

/** The rangoli has six petals; the first is always gold, so five can fill. */
export const MAX_MILESTONES = 5;

function toDay(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
}

function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(toDay(toIso) - toDay(fromIso));
}

export function addDays(iso: string, days: number): string {
  return fromDay(toDay(iso) + days);
}

/** Reads labels like "8 weeks before", "2 months before", "Day before", "Event day". */
export function parseWhen(label: string): number | null {
  const text = label.toLowerCase();
  if (/\b(event|wedding|party|big|on the) day\b|\bday of\b/.test(text)) return 0;
  if (/\bday before\b/.test(text)) return 1;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:-\s*\d+\s*)?(day|week|month)s?/);
  return match ? Math.round(Number(match[1]) * UNIT_DAYS[match[2]]) : null;
}

/** Default booking time for vendors the AI gave no date for. */
function vendorDefault(priority: Plan["vendors"][number]["priority"]): number {
  return priority === "must-have" ? 60 : 30;
}

/**
 * Fills in missing day counts, keeps steps in date order and makes sure no
 * step starts before today (a plan made 3 weeks out has nothing "12 weeks before").
 */
export function normalizeTimeline(plan: Plan, eventDate: string, today: string): Plan {
  const daysLeft = Math.max(0, daysBetween(today, eventDate));
  const clamp = (n: number) => Math.min(Math.max(0, n), daysLeft);
  const timeline = plan.timeline
    .map((step, i, all) => {
      const guess = step.daysBefore ?? parseWhen(step.when);
      // Unknown labels sit between their neighbours, ordered as the AI listed them.
      const fallback = Math.round(daysLeft * (1 - i / Math.max(1, all.length - 1)));
      return { ...step, daysBefore: clamp(guess ?? fallback) };
    })
    .sort((a, b) => b.daysBefore - a.daysBefore);
  const vendors = plan.vendors.map((v) => ({
    ...v,
    bookByDaysBefore: clamp(v.bookByDaysBefore ?? vendorDefault(v.priority)),
  }));
  return { ...plan, timeline, vendors };
}

export function statusOf(due: string, today: string, isDone: boolean): Status {
  if (isDone) return "done";
  const gap = daysBetween(today, due);
  if (gap < 0) return "overdue";
  return gap <= DUE_SOON_DAYS ? "due-soon" : "upcoming";
}

/** Every task and vendor booking with its priority, due date and status. */
export function schedule(
  plan: Plan,
  eventDate: string,
  today: string,
  done: Done,
  shifts: Shifts = {},
): { timeline: ScheduledItem[][]; vendors: ScheduledItem[]; stepDue: string[] } {
  const structure = planStructure(plan);
  const lastDay = addDays(eventDate, -1);
  /** Planned date plus any delay; nothing before the event day is pushed onto or past it. */
  const shiftedDue = (base: string, id: string) => {
    const extra = Math.max(0, Math.round(shifts[id] ?? 0));
    if (!extra || base >= eventDate) return { due: base, shifted: 0 };
    const wanted = addDays(base, extra);
    const due = wanted > lastDay ? (base > lastDay ? base : lastDay) : wanted;
    return { due, shifted: daysBetween(base, due) };
  };
  const stepDue = plan.timeline.map((step) => addDays(eventDate, -(step.daysBefore ?? parseWhen(step.when) ?? 0)));
  const timeline = structure.timeline.map((items, s) =>
    items.map((item, t) => {
      const { due, shifted } = shiftedDue(stepDue[s], item.id);
      return {
        ...item,
        priority: plan.timeline[s].tasks[t].priority,
        milestone: plan.timeline[s].tasks[t].milestone,
        due,
        shifted,
        status: statusOf(due, today, Boolean(done[item.id])),
      };
    }),
  );
  const vendors = structure.vendors.map((item, v) => {
    const vendor = plan.vendors[v];
    const base = addDays(eventDate, -(vendor.bookByDaysBefore ?? vendorDefault(vendor.priority)));
    const { due, shifted } = shiftedDue(base, item.id);
    return {
      ...item,
      priority: (vendor.priority === "must-have" ? "high" : "low") as Priority,
      milestone: vendor.priority === "must-have",
      due,
      shifted,
      status: statusOf(due, today, Boolean(done[item.id])),
    };
  });
  return { timeline, vendors, stepDue };
}

/* ------------------------------------------------------------------ */
/* Running late: move a task and everything after it.                  */
/* ------------------------------------------------------------------ */

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

/**
 * The few things to do next: overdue first, then by due date, then by
 * priority. Optionally only one person's items.
 */
export function doNext(items: ScheduledItem[], assignments: Assignments, viewer = "", limit = 5): ScheduledItem[] {
  return items
    .filter((i) => i.status !== "done" && (!viewer || assignments[i.id] === viewer))
    .sort(
      (a, b) =>
        Number(b.status === "overdue") - Number(a.status === "overdue") ||
        a.due.localeCompare(b.due) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    )
    .slice(0, limit);
}

/** "9 Jan" style date for compact display. */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function dueText(item: Pick<ScheduledItem, "due" | "status">, today: string): string {
  if (item.status === "done") return "Done";
  const gap = daysBetween(today, item.due);
  if (gap < 0) return `Overdue · was due ${shortDate(item.due)}`;
  if (gap === 0) return "Due today";
  if (gap === 1) return "Due tomorrow";
  return `By ${shortDate(item.due)}`;
}

/**
 * The plan's milestones, in date order: tasks the AI flagged plus must-have
 * vendor bookings. If the AI flagged none, the high-priority tasks stand in.
 */
export function milestoneItems(items: ScheduledItem[]): ScheduledItem[] {
  const flagged = items.filter((i) => i.milestone);
  const chosen = flagged.length > 0 ? flagged : items.filter((i) => i.priority === "high");
  return [...chosen].sort((a, b) => a.due.localeCompare(b.due)).slice(0, MAX_MILESTONES);
}

/** How many of the five colour petals are filled (0–5). Everything done fills all. */
export function petalsFilled(milestones: ScheduledItem[], progress: number): number {
  if (progress >= 1) return MAX_MILESTONES;
  if (milestones.length === 0) return Math.floor(progress * MAX_MILESTONES);
  const done = milestones.filter((m) => m.status === "done").length;
  return Math.min(MAX_MILESTONES, Math.round((done / milestones.length) * MAX_MILESTONES));
}

const CHEERS = [
  "The rest gets easier.",
  "One big step closer.",
  "Your celebration is taking shape.",
  "Lovely. Keep going.",
  "Nearly there.",
];

/** A short, warm line for a milestone: "Caterer booked. The rest gets easier." */
export function bloomMessage(item: Pick<PlanItem, "label">, index: number): string {
  const booking = item.label.match(/^book (?:the |a |an )?(.+)$/i);
  const what = booking ? `${booking[1].charAt(0).toUpperCase()}${booking[1].slice(1)} booked.` : `${item.label}: done.`;
  return `${what} ${CHEERS[index % CHEERS.length]}`;
}
