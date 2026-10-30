import { z } from "zod";
import { hash } from "./hash";
import { IdeaStateSchema, type IdeaState } from "./ideas/schema";
import { DEFAULT_SEATING, SeatingSchema, type Seating } from "./seating";
import { GuestListSchema, type GuestList } from "./guestList";
import { DealsSchema, type Deals } from "./deals";
import { InviteSchema, type Invite } from "./invite";
import type { DayTimings } from "./muhurat";
import type { Shifts } from "./schedule";
import { makeEventInputSchema, PlanSchema, type EventInput, type Plan } from "./schemas";
import { ID, localId, TOKEN } from "./ids";
import { NAME_TEXT, nameField } from "./validation";

/* ------------------------------------------------------------------ */
/* Team members and the tasks they own.                               */
/* ------------------------------------------------------------------ */

export const MemberSchema = z.object({
  id: z.string().regex(ID.member),
  name: nameField(40, { empty: "Please enter a name", invalid: "Name contains characters that are not allowed" }),
  role: z
    .string()
    .trim()
    .max(40, "Role is too long")
    .refine((v) => v === "" || NAME_TEXT.test(v), "Role contains characters that are not allowed")
    .default(""),
});

export type Member = z.infer<typeof MemberSchema>;

export const MAX_MEMBERS = 15;
export const TeamSchema = z.array(MemberSchema).max(MAX_MEMBERS, `Up to ${MAX_MEMBERS} people can be added`);

const ItemId = z.string().regex(ID.planItem);
export const AssignmentsSchema = z.record(ItemId, z.string().regex(ID.member));
export const DoneSchema = z.record(ItemId, z.boolean());
/** Extra days per task after something ran late (see schedule.ts). */
export const ShiftsSchema = z.record(ItemId, z.number().int().min(1).max(400));

export type Assignments = z.infer<typeof AssignmentsSchema>;
export type Done = z.infer<typeof DoneSchema>;

/* ------------------------------------------------------------------ */
/* Stable ids for plan items, so ticks survive small plan changes.     */
/* ------------------------------------------------------------------ */

export { hash };

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
  return localId("m");
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
  /** Vendor quotes, bookings and agreements, by vendor item id. Older plans may not have it. */
  deals?: Deals;
  /** The invitation card, once the host has made one. */
  invite?: Invite | null;
  /** Days each task was pushed back after something ran late. Older plans may not have it. */
  shifts?: Shifts;
  /** Seating settings and the families the host moved. */
  seating?: Seating;
  /** The host's own guest list. */
  guestList?: GuestList;
  /** The heart of the event, theme directions and which ideas were kept, skipped or added. */
  ideaState?: IdeaState;
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
  const input = makeEventInputSchema(now, { allowPast: true });
  return z.object({
    input,
    plan: PlanSchema,
    timings: TimingsSchema.default(null),
    team: TeamSchema.default([]),
    assignments: AssignmentsSchema.default({}),
    deals: DealsSchema.default({}),
    invite: InviteSchema.nullable().catch(null).default(null),
    shifts: ShiftsSchema.catch({}).default({}),
    seating: SeatingSchema.catch(DEFAULT_SEATING).default(DEFAULT_SEATING),
    guestList: GuestListSchema.default([]),
    ideaState: IdeaStateSchema.optional().catch(undefined),
  });
}

export const ProgressSchema = z.object({ itemId: ItemId, done: z.boolean() });

/** Share links use 128 random bits, so they cannot be guessed. */
export const SHARE_ID = TOKEN;

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
