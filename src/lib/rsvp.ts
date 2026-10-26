import { z } from "zod";
import type { Invite } from "./invite";
import { inviteFacts } from "./invite";
import {
  EVENT_TYPE_LABELS,
  GUEST_NEED_LABELS,
  GUEST_NEEDS,
  safeText,
  type EventInput,
  type EventType,
  type FoodPref,
  type GuestNeed,
} from "./schemas";

/**
 * Guest replies (RSVPs). One link for all guests: each family opens it, says
 * whether they're coming, how many people, their food and any needs. The host
 * sees live counts (people, food, needs) and can update the plan's guest count
 * from them. The guest link never reveals the plan, budget or team link.
 */

export const MAX_REPLIES = 3000;
export const MAX_PARTY = 30;

export const RSVP_TOKEN = /^[A-Za-z0-9_-]{22}$/;
export const REPLY_ID = /^r[a-z0-9]{6,16}$/;
export const REPLY_SECRET = /^[A-Za-z0-9_-]{22}$/;

export const COMING = ["yes", "maybe", "no"] as const;
export type Coming = (typeof COMING)[number];
export const COMING_LABELS: Record<Coming, string> = { yes: "Coming", maybe: "Maybe", no: "Can't come" };

/** What a family eats. "any" means no special food. */
export const GUEST_FOODS = ["any", "veg", "jain", "no-onion-garlic", "non-veg"] as const;
export type GuestFood = (typeof GUEST_FOODS)[number];
export const GUEST_FOOD_LABELS: Record<GuestFood, string> = {
  any: "No preference",
  veg: "Vegetarian",
  jain: "Jain",
  "no-onion-garlic": "No onion or garlic",
  "non-veg": "Non-veg",
};

/** Food choices to offer guests. Non-veg only when the menu may have it. */
export function foodChoices(eventFood: FoodPref): GuestFood[] {
  const vegOnly = eventFood === "veg" || eventFood === "jain" || eventFood === "no-onion-garlic";
  return GUEST_FOODS.filter((f) => !(vegOnly && f === "non-veg"));
}

/** Which side the guest is from, used to seat families together. */
export const GUEST_GROUPS = ["", "bride", "groom", "family", "friends", "work", "neighbours", "other"] as const;
export type GuestGroup = (typeof GUEST_GROUPS)[number];
export const GUEST_GROUP_LABELS: Record<GuestGroup, string> = {
  "": "Not said",
  bride: "Bride's side",
  groom: "Groom's side",
  family: "Family",
  friends: "Friends",
  work: "Work",
  neighbours: "Neighbours",
  other: "Other",
};

const WEDDING_TYPES: ReadonlySet<EventType> = new Set<EventType>(["wedding", "engagement"]);

/** Group choices to offer guests, depending on the kind of event. */
export function groupChoices(eventType: EventType): GuestGroup[] {
  return WEDDING_TYPES.has(eventType)
    ? ["bride", "groom", "friends", "work", "other"]
    : ["family", "friends", "work", "neighbours", "other"];
}

/** Needs a guest can tell the host about (the host's own list, in guest words). */
export const GUEST_REPLY_NEEDS = GUEST_NEEDS.filter((n) => n !== "quiet-room");
export const GUEST_REPLY_NEED_LABELS: Partial<Record<GuestNeed, string>> = {
  elderly: "An elderly person is with us",
  wheelchair: "Wheelchair or step-free access",
  "young-kids": "Baby or young child (high chair, feeding space)",
  "hearing-sight": "Hearing or sight support",
  allergies: "Food allergy (say which in the note)",
};

const NAME_TEXT = /^[\p{L}\p{M}\p{N}\s.,'&()\-/]+$/u;

const needsList = z
  .array(z.string())
  .default([])
  .transform((list) => [...new Set(list)].filter((v): v is GuestNeed => (GUEST_REPLY_NEEDS as string[]).includes(v)));

const count = (label: string) =>
  z.coerce
    .number({ message: `Please enter the number of ${label}` })
    .int(`Please enter a whole number of ${label}`)
    .min(0, `Please enter the number of ${label}`)
    .max(MAX_PARTY, `Up to ${MAX_PARTY} ${label} per reply`);

/** A guest's reply, as sent from the guest page. */
export const ReplyInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Please enter your name")
      .max(60, "Name is too long")
      .regex(NAME_TEXT, "Name can only contain letters and numbers"),
    phone: z
      .string()
      .trim()
      .max(20, "Phone number is too long")
      .regex(/^[0-9+\s-]*$/, "Phone can only contain numbers")
      .default(""),
    coming: z.enum(COMING, { message: "Please say whether you can come" }),
    adults: count("adults").default(1),
    kids: count("children").default(0),
    food: z.enum(GUEST_FOODS).catch("any").default("any"),
    needs: needsList,
    group: z.enum(GUEST_GROUPS).catch("").default(""),
    note: safeText(200, "Note").default(""),
  })
  .transform((r) => (r.coming === "no" ? { ...r, adults: 0, kids: 0, needs: [], food: "any" as const } : r))
  .refine((r) => r.coming === "no" || r.adults + r.kids >= 1, {
    message: "Please say how many people are coming",
    path: ["adults"],
  });
export type ReplyInput = z.infer<typeof ReplyInputSchema>;

/** A reply as stored and shown to the host. */
export interface Reply extends ReplyInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const SubmitReplySchema = z.object({
  reply: z.unknown(),
  /** Set when the same guest changes their reply. */
  replyId: z.string().regex(REPLY_ID).optional(),
  secret: z.string().regex(REPLY_SECRET).optional(),
});

/* ------------------------------------------------------------------ */
/* What the guest page shows. Never the plan, budget or team link.     */
/* ------------------------------------------------------------------ */

export interface GuestEvent {
  title: string;
  eventType: EventType;
  date: string;
  city: string;
  time: string;
  venue: string;
  heading: string;
  message: string;
  closing: string;
  open: boolean;
  foods: GuestFood[];
  groups: GuestGroup[];
}

export function guestEvent(input: EventInput, invite: Invite | null | undefined, open: boolean): GuestEvent {
  const title = input.eventName || EVENT_TYPE_LABELS[input.eventType];
  const facts = invite ? inviteFacts(input, { ...invite.details, language: "en" }) : null;
  return {
    title,
    eventType: input.eventType,
    date: input.date,
    city: input.city,
    time: invite?.details.time ?? "",
    venue: facts?.venue ?? input.city,
    heading: invite?.wording.heading ?? "You're invited!",
    message: invite?.wording.message ?? `Please join us for ${title}.`,
    closing: invite?.wording.closing ?? "",
    open,
    foods: foodChoices(input.food),
    groups: groupChoices(input.eventType),
  };
}

/* ------------------------------------------------------------------ */
/* Counts for the host, worked out in code.                            */
/* ------------------------------------------------------------------ */

export interface ReplySummary {
  replies: number;
  coming: { families: number; adults: number; kids: number; people: number };
  maybe: { families: number; people: number };
  notComing: number;
  /** People coming (yes) by food, plus maybes counted separately. */
  food: { food: GuestFood; people: number; maybe: number }[];
  needs: { need: GuestNeed; families: number }[];
  /** Expected head count: coming plus maybe. */
  expected: number;
}

export function summarize(replies: Reply[]): ReplySummary {
  const yes = replies.filter((r) => r.coming === "yes");
  const maybe = replies.filter((r) => r.coming === "maybe");
  const people = (list: Reply[]) => list.reduce((s, r) => s + r.adults + r.kids, 0);
  const food = GUEST_FOODS.map((f) => ({
    food: f,
    people: people(yes.filter((r) => r.food === f)),
    maybe: people(maybe.filter((r) => r.food === f)),
  })).filter((f) => f.people + f.maybe > 0);
  const needs = GUEST_REPLY_NEEDS.map((n) => ({
    need: n,
    families: [...yes, ...maybe].filter((r) => r.needs.includes(n)).length,
  })).filter((n) => n.families > 0);
  const comingPeople = people(yes);
  const maybePeople = people(maybe);
  return {
    replies: replies.length,
    coming: {
      families: yes.length,
      adults: yes.reduce((s, r) => s + r.adults, 0),
      kids: yes.reduce((s, r) => s + r.kids, 0),
      people: comingPeople,
    },
    maybe: { families: maybe.length, people: maybePeople },
    notComing: replies.filter((r) => r.coming === "no").length,
    food,
    needs,
    expected: comingPeople + maybePeople,
  };
}

/**
 * Suggests updating the plan's guest count when replies point to a number
 * clearly different from it. Only once at least a few families have replied.
 */
export function suggestedGuests(summary: ReplySummary, planned: number): number | null {
  if (summary.coming.families + summary.maybe.families < 3) return null;
  const expected = summary.expected;
  if (expected < 1) return null;
  const gap = Math.abs(expected - planned);
  return gap >= Math.max(5, planned * 0.05) && expected > planned ? expected : null;
}

/** Lines for needs, e.g. "Wheelchair or step-free access: 2 families". */
export function needLine(need: GuestNeed, families: number): string {
  return `${GUEST_NEED_LABELS[need]}: ${families} ${families === 1 ? "family" : "families"}`;
}

/** Message to send guests on WhatsApp, with the reply link. */
export function rsvpMessage(title: string, link: string, inviteText = ""): string {
  const ask = `Please tell us if you can come to ${title}, and how many of you: ${link}`;
  return inviteText ? `${inviteText}\n\n${ask}` : ask;
}

const csvCell = (value: string | number) => {
  const text = String(value);
  // Stop spreadsheet apps treating a cell as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The replies as a spreadsheet file (CSV), for the caterer or a printout. */
export function repliesCsv(replies: Reply[]): string {
  const head = ["Name", "Phone", "Reply", "Adults", "Children", "Food", "Side", "Needs", "Note", "Replied on"];
  const rows = replies.map((r) => [
    r.name,
    r.phone,
    COMING_LABELS[r.coming],
    r.adults,
    r.kids,
    GUEST_FOOD_LABELS[r.food],
    GUEST_GROUP_LABELS[r.group],
    r.needs.map((n) => GUEST_NEED_LABELS[n]).join("; "),
    r.note,
    r.updatedAt.slice(0, 10),
  ]);
  return [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
