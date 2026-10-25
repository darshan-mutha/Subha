import { z } from "zod";
import type { DayTimings } from "./muhurat";
import { makeEventInputSchema, PlanSchema, type EventInput, type Plan } from "./schemas";

/* ------------------------------------------------------------------ */
/* Team members and the tasks they own.                               */
/* ------------------------------------------------------------------ */

const NAME_TEXT = /^[\p{L}\p{M}\p{N}\s.'\-()&]+$/u;

export const MemberSchema = z.object({
  id: z.string().regex(/^m[a-z0-9]{1,12}$/),
  name: z
    .string()
    .trim()
    .min(1, "Please enter a name")
    .max(40, "Name is too long")
    .regex(NAME_TEXT, "Name contains characters that are not allowed"),
  role: z
    .string()
    .trim()
    .max(40, "Role is too long")
    .regex(/^[\p{L}\p{M}\p{N}\s.'\-()&,/]*$/u, "Role contains characters that are not allowed")
    .default(""),
});

export type Member = z.infer<typeof MemberSchema>;

export const MAX_MEMBERS = 15;
export const TeamSchema = z.array(MemberSchema).max(MAX_MEMBERS, `Up to ${MAX_MEMBERS} people can be added`);

const ItemId = z.string().regex(/^[tv]_[a-z0-9]{1,12}$/);
export const AssignmentsSchema = z.record(ItemId, z.string().regex(/^m[a-z0-9]{1,12}$/));
export const DoneSchema = z.record(ItemId, z.boolean());

export type Assignments = z.infer<typeof AssignmentsSchema>;
export type Done = z.infer<typeof DoneSchema>;

/* ------------------------------------------------------------------ */
/* Stable ids for plan items, so ticks survive small plan changes.     */
/* ------------------------------------------------------------------ */

/** Small, fast string hash (FNV-1a) used to give tasks stable ids. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export interface PlanItem {
  id: string;
  kind: "task" | "vendor";
  label: string;
  group: string;
}

/** Tasks per timeline step and one booking item per vendor, with ids derived from their text. */
export function planStructure(plan: Plan): { timeline: PlanItem[][]; vendors: PlanItem[] } {
  const seen = new Set<string>();
  const make = (kind: PlanItem["kind"], prefix: "t" | "v", label: string, group: string): PlanItem => {
    let id = `${prefix}_${hash(`${group}|${label}`.toLowerCase())}`;
    while (seen.has(id)) id = `${prefix}_${hash(id)}`;
    seen.add(id);
    return { id, kind, label, group };
  };
  return {
    timeline: plan.timeline.map((step) => step.tasks.map(({ task }) => make("task", "t", task, step.when))),
    vendors: plan.vendors.map((v) => make("vendor", "v", `Book ${v.type.toLowerCase()}`, "Vendors")),
  };
}

/** Every task and vendor booking in a plan, in display order. */
export function planItems(plan: Plan): PlanItem[] {
  const { timeline, vendors } = planStructure(plan);
  return [...timeline.flat(), ...vendors];
}

/** Drops assignments and ticks that point at items or people that no longer exist. */
export function pruneState(plan: Plan, team: Member[], assignments: Assignments, done: Done) {
  const ids = new Set(planItems(plan).map((i) => i.id));
  const people = new Set(team.map((m) => m.id));
  return {
    assignments: Object.fromEntries(Object.entries(assignments).filter(([k, v]) => ids.has(k) && people.has(v))),
    done: Object.fromEntries(Object.entries(done).filter(([k]) => ids.has(k))),
  };
}

export function newMemberId(): string {
  return `m${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Shared plan document.                                               */
/* ------------------------------------------------------------------ */

export interface SharedPlanContent {
  input: EventInput;
  plan: Plan;
  timings: DayTimings | null;
  team: Member[];
  assignments: Assignments;
}

export interface SharedPlan extends SharedPlanContent {
  id: string;
  version: number;
  done: Done;
  updatedAt: string;
}

const TimeRangeSchema = z.object({ start: z.string().max(20), end: z.string().max(20) });
export const TimingsSchema = z
  .object({
    location: z.string().max(120),
    date: z.string().max(10),
    weekday: z.string().max(10),
    sunrise: z.string().max(20),
    sunset: z.string().max(20),
    rahuKalam: TimeRangeSchema,
    yamagandam: TimeRangeSchema,
    gulikaKalam: TimeRangeSchema,
    betterWindows: z.array(TimeRangeSchema).max(8),
  })
  .nullable();

/**
 * Content accepted when saving a shared plan. Dates already in the past are
 * allowed here, because a shared plan stays useful up to and on the day.
 */
export function makeSharedContentSchema(now: Date = new Date()) {
  const input = makeEventInputSchema(new Date(now.getTime() - 400 * 86_400_000));
  return z.object({
    input,
    plan: PlanSchema,
    timings: TimingsSchema.default(null),
    team: TeamSchema.default([]),
    assignments: AssignmentsSchema.default({}),
  });
}

export const ProgressSchema = z.object({ itemId: ItemId, done: z.boolean() });

/** Share links use 128 random bits, so they cannot be guessed. */
export const SHARE_ID = /^[A-Za-z0-9_-]{22}$/;

/* ------------------------------------------------------------------ */
/* WhatsApp messages.                                                  */
/* ------------------------------------------------------------------ */

export function memberMessage(
  member: Member,
  items: (PlanItem & { dueLabel?: string })[],
  eventTitle: string,
  link: string,
): string {
  const lines = items.length
    ? items
        .map((i) => `• ${i.label}${i.dueLabel ? ` (${i.dueLabel})` : i.kind === "task" ? ` (${i.group})` : ""}`)
        .join("\n")
    : "• No tasks yet. Please check the plan.";
  return `Hi ${member.name}! Here are your tasks for ${eventTitle}:\n\n${lines}\n\nPlease tick them off in our shared plan as you finish: ${link}`;
}

export function teamInviteMessage(eventTitle: string, link: string): string {
  return `Let's plan ${eventTitle} together! Here's our shared plan on Shubā. Open it to see your tasks and tick them off when done: ${link}`;
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
