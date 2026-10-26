import { z } from "zod";
import { MAX_DAYS, MAX_FUNCTIONS, MODERN_ADDITIONS, TRADITIONS } from "./traditions";

/** Event types Shubā supports. Kept as a closed list so prompts stay predictable. */
export const EVENT_TYPES = [
  "wedding",
  "engagement",
  "birthday",
  "anniversary",
  "baby-shower",
  "naming-ceremony",
  "housewarming",
  "religious-ceremony",
  "festival",
  "community-event",
  "corporate-event",
  "school-event",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Wedding",
  engagement: "Engagement",
  birthday: "Birthday",
  anniversary: "Anniversary",
  "baby-shower": "Baby shower",
  "naming-ceremony": "Naming ceremony",
  housewarming: "Housewarming (Griha Pravesh)",
  "religious-ceremony": "Religious ceremony / Pooja",
  festival: "Festival celebration",
  "community-event": "Community event",
  "corporate-event": "Corporate event",
  "school-event": "School / college event",
  other: "Other",
};

/** Event types where auspicious timings are shown by default. */
export const TRADITIONAL_EVENT_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  "wedding",
  "engagement",
  "naming-ceremony",
  "housewarming",
  "religious-ceremony",
  "festival",
]);

/** Areas the host can rank as "what matters most". Protected when costs are cut. */
export const FOCUS_AREAS = ["food", "decor", "photos", "venue", "entertainment", "rituals"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];
export const FOCUS_LABELS: Record<FocusArea, string> = {
  food: "Food",
  decor: "Decor",
  photos: "Photos & video",
  venue: "Venue",
  entertainment: "Music & fun",
  rituals: "Rituals & traditions",
};
export const MAX_FOCUS = 3;

export const FOOD_PREFS = ["", "veg", "jain", "no-onion-garlic", "veg-and-non-veg"] as const;
export type FoodPref = (typeof FOOD_PREFS)[number];
export const FOOD_LABELS: Record<FoodPref, string> = {
  "": "No preference",
  veg: "Vegetarian",
  jain: "Jain",
  "no-onion-garlic": "No onion or garlic",
  "veg-and-non-veg": "Veg and non-veg",
};

/** Guest needs that change the venue, food and timeline. */
export const GUEST_NEEDS = ["elderly", "wheelchair", "young-kids", "hearing-sight", "allergies", "quiet-room"] as const;
export type GuestNeed = (typeof GUEST_NEEDS)[number];
export const GUEST_NEED_LABELS: Record<GuestNeed, string> = {
  elderly: "Elderly guests",
  wheelchair: "Wheelchair or step-free access",
  "young-kids": "Babies and young children",
  "hearing-sight": "Hearing or sight support",
  allergies: "Food allergies",
  "quiet-room": "Quiet or rest room",
};

/** Keeps known values only, without duplicates, so old or odd input never breaks a plan. */
function choiceList<T extends string>(values: readonly T[], max: number) {
  return z
    .array(z.string())
    .default([])
    .transform((list) => [...new Set(list)].filter((v): v is T => (values as readonly string[]).includes(v)))
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).max(max, `Choose up to ${max}`));
}

export const LIMITS = {
  minGuests: 1,
  maxGuests: 10000,
  minBudget: 1000,
  maxBudget: 1_000_000_000,
  maxYearsAhead: 3,
  maxNotes: 500,
  maxInstruction: 300,
} as const;

/** Allows letters (any script), spaces and a few separators. Blocks markup and code-like input. */
const SAFE_TEXT = /^[\p{L}\p{M}\p{N}\s.,'&()\-/!?:;₹%+#@"]*$/u;
const CITY_TEXT = /^[\p{L}\p{M}\s.,'\-()]+$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const safeText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .regex(SAFE_TEXT, `${label} contains characters that are not allowed`);

/** Returns today's date (YYYY-MM-DD) in India. Event dates are compared in IST. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(y) + years}-${m}-${d}`;
}

export function makeEventInputSchema(now: Date = new Date()) {
  const today = todayIST(now);
  const latest = addYears(today, LIMITS.maxYearsAhead);
  return z.object({
    eventType: z.enum(EVENT_TYPES, { message: "Please choose an event type" }),
    eventName: safeText(80, "Event name").optional().default(""),
    date: z
      .string()
      .trim()
      .refine(isRealDate, "Please enter a valid date")
      .refine((v) => v >= today, "The event date cannot be in the past")
      .refine((v) => v <= latest, `Please choose a date within ${LIMITS.maxYearsAhead} years`),
    city: z
      .string()
      .trim()
      .min(2, "Please enter a city")
      .max(60, "City name is too long")
      .regex(CITY_TEXT, "City name can only contain letters"),
    guests: z.coerce
      .number({ message: "Please enter the number of guests" })
      .int("Guests must be a whole number")
      .min(LIMITS.minGuests, "There must be at least 1 guest")
      .max(LIMITS.maxGuests, `Shubā supports up to ${LIMITS.maxGuests.toLocaleString("en-IN")} guests`),
    budget: z.coerce
      .number({ message: "Please enter a budget" })
      .min(LIMITS.minBudget, `Budget must be at least ₹${LIMITS.minBudget.toLocaleString("en-IN")}`)
      .max(LIMITS.maxBudget, "Budget is too large"),
    style: safeText(60, "Style").optional().default(""),
    notes: safeText(LIMITS.maxNotes, "Notes").optional().default(""),
    includeMuhurat: z.boolean().optional().default(false),
    focus: choiceList(FOCUS_AREAS, MAX_FOCUS),
    food: z.enum(FOOD_PREFS).catch("").default(""),
    guestNeeds: choiceList(GUEST_NEEDS, GUEST_NEEDS.length),
    /** Up to two traditions: the host's family and the other family, if different. */
    traditions: choiceList(TRADITIONS, 2),
    /** The tradition in the host's own words when "Other" is chosen. */
    traditionOther: safeText(60, "Tradition").optional().default(""),
    /** How many days the celebration runs over (day 1 is the event date). */
    days: z.coerce.number().int().min(1).max(MAX_DAYS).catch(1).default(1),
    /** The functions the host chose and the day each one is on (0 = before the main days). */
    functions: z
      .array(
        z.object({
          name: safeText(40, "Function name").min(1, "Please name the function"),
          day: z.coerce.number().int().min(0).max(MAX_DAYS).catch(1),
        }),
      )
      .max(MAX_FUNCTIONS, `Choose up to ${MAX_FUNCTIONS} functions`)
      .default([]),
    /** Modern additions (bachelor party, pre-wedding shoot…). */
    additions: choiceList(MODERN_ADDITIONS, MODERN_ADDITIONS.length),
  });
}

export type EventInput = z.infer<ReturnType<typeof makeEventInputSchema>>;

/** Fills in fields added after a plan was saved (traditions, days, functions…). */
export function withInputDefaults(input: EventInput): EventInput {
  return {
    ...input,
    focus: input.focus ?? [],
    food: input.food ?? "",
    guestNeeds: input.guestNeeds ?? [],
    traditions: input.traditions ?? [],
    traditionOther: input.traditionOther ?? "",
    days: input.days ?? 1,
    functions: input.functions ?? [],
    additions: input.additions ?? [],
  };
}

/* ------------------------------------------------------------------ */
/* Plan returned by the AI. Validated before it ever reaches the UI.   */
/* ------------------------------------------------------------------ */

/**
 * Cuts over-long text at a word boundary. A label that runs a few characters
 * long is trimmed rather than throwing away the whole AI reply (a retry costs
 * the host another 20-30 seconds).
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–(]+$/u, "")}…`;
}

const str = (max = 400) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((v) => clip(v, max));
/** A list that keeps its first `maxItems` items instead of rejecting a longer one. */
const upTo = <T extends z.ZodTypeAny>(item: T, maxItems: number) =>
  z.array(item).transform((list) => list.slice(0, maxItems));
const strList = (maxItems: number, max = 200) => upTo(str(max), maxItems).default([]);
/** Keeps the items that are valid and drops the rest, so one odd idea never loses the others. */
const validItems = <T extends z.ZodTypeAny>(item: T, maxItems: number) =>
  z
    .array(z.unknown())
    .transform((list) =>
      list
        .map((x) => item.safeParse(x))
        .filter((r) => r.success)
        .map((r) => r.data as z.infer<T>)
        .slice(0, maxItems),
    )
    .catch([])
    .default([]);

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** A timeline task. Plain strings (plans saved before priorities existed) are still accepted. */
const TaskSchema = z.union([
  str(200).transform((task) => ({ task, priority: "medium" as Priority, milestone: false })),
  z.object({
    task: str(200),
    priority: z.enum(PRIORITIES).catch("medium"),
    /** A big moment (venue booked, invites sent) that fills a rangoli petal. */
    milestone: z.boolean().catch(false).default(false),
  }),
]);

/** Whole days before the event (0 = event day). Missing values are worked out from the label. */
const DaysBefore = z.number().int().min(0).max(1200).nullable().default(null);

/** "#0E5A63"-style colours only; anything else is dropped. */
const HEX = /^#[0-9a-fA-F]{6}$/;
const swatches = z
  .array(z.unknown())
  .transform((list) =>
    list
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim())
      .filter((c) => HEX.test(c))
      .slice(0, 5),
  )
  .catch([])
  .default([]);

/** Where an idea happens in the guest's day. */
export const MOMENTS = ["arrival", "welcome", "main", "food", "fun", "send-off"] as const;
export type Moment = (typeof MOMENTS)[number];
export const MOMENT_LABELS: Record<Moment, string> = {
  arrival: "Arrival",
  welcome: "Welcome",
  main: "The main moment",
  food: "Food & drinks",
  fun: "Fun & music",
  "send-off": "Send-off & return gifts",
};

/** How much work an idea is: do it yourselves, needs a few helpers, or needs a vendor. */
export const EFFORTS = ["easy", "help", "vendor"] as const;
export type Effort = (typeof EFFORTS)[number];
export const EFFORT_LABELS: Record<Effort, string> = {
  easy: "Easy to do yourselves",
  help: "Needs a few helpers",
  vendor: "Needs a vendor",
};

export const IdeaSchema = z.object({
  title: str(80),
  detail: z
    .string()
    .trim()
    .max(400)
    .catch("")
    .default("")
    .transform((v) => clip(v, 240)),
  /** Why this suits this family and this event, in one line. */
  why: z
    .string()
    .trim()
    .max(300)
    .catch("")
    .default("")
    .transform((v) => clip(v, 160)),
  moment: z.enum(MOMENTS).catch("main"),
  /** The function it belongs to (e.g. "Mehendi"), or "" for the whole event. */
  forFunction: z
    .string()
    .trim()
    .max(60)
    .catch("")
    .default("")
    .transform((v) => clip(v, 40)),
  /** Rough cost in rupees, an estimate only. */
  cost: z.number().nonnegative().catch(0).default(0),
  effort: z.enum(EFFORTS).catch("help"),
});
export type Idea = z.infer<typeof IdeaSchema>;

export const SignatureSchema = z.object({ title: str(80), detail: str(300) });
export type Signature = z.infer<typeof SignatureSchema>;

const NewIdeasSchema = z.object({
  /** The one moment guests will talk about later. */
  signature: SignatureSchema.nullable().catch(null).default(null),
  items: validItems(IdeaSchema, 40),
});

/** Plans saved before 27 Oct 2026 had four plain lists; they are read into the new shape. */
const OldIdeasSchema = z
  .object({
    // Required (no defaults), so a plan in the new shape never matches by accident.
    decor: z.array(z.string()),
    food: z.array(z.string()).catch([]),
    activities: z.array(z.string()).catch([]),
    extras: z.array(z.string()).catch([]),
  })
  .transform(({ decor, food, activities, extras }) => {
    const make = (moment: Moment) => (title: string) => IdeaSchema.safeParse({ title, moment, effort: "help" });
    const list = (titles: string[], moment: Moment) =>
      titles
        .slice(0, 6)
        .map(make(moment))
        .filter((r) => r.success)
        .map((r) => r.data as Idea);
    return {
      signature: null as Signature | null,
      items: [
        ...list(decor, "welcome"),
        ...list(food, "food"),
        ...list(activities, "fun"),
        ...list(extras, "send-off"),
      ],
    };
  });

export const IdeasSchema = z.union([OldIdeasSchema, NewIdeasSchema]);
export type Ideas = z.infer<typeof NewIdeasSchema>;

/** One function of a multi-day event (mehendi, sangeet, nikah…), as planned. */
export const FunctionPlanSchema = z.object({
  name: str(40),
  /** 1 = first day; 0 = before the main days. */
  day: z.number().int().min(0).max(MAX_DAYS).catch(1),
  /** Rough time of day, e.g. "Evening, 7-11 pm". */
  time: z
    .string()
    .trim()
    .max(80)
    .catch("")
    .default("")
    .transform((v) => clip(v, 40)),
  guests: z.number().int().nonnegative().catch(0).default(0),
  /** Estimated share of the budget, in rupees. Scaled in code to add up to the total. */
  amount: z.number().nonnegative().catch(0).default(0),
  /** The feel of this function within the overall theme. */
  mood: z
    .string()
    .trim()
    .max(300)
    .catch("")
    .default("")
    .transform((v) => clip(v, 160)),
  /** What is usually done. Families differ, so the plan says to check with elders. */
  rituals: strList(6, 160).catch([]),
  /** What is needed: officiant, ritual items, attire. */
  needs: strList(6, 160).catch([]),
});
export type FunctionPlan = z.infer<typeof FunctionPlanSchema>;

export const PlanSchema = z.object({
  summary: str(600),
  theme: z.object({
    name: str(80),
    description: str(400),
    colors: strList(5, 40),
    /** The same colours as #hex codes, for colour dots. Older plans may not have them. */
    swatches,
  }),
  /** Functions of a multi-day event, in order. Empty for single-function events. */
  functions: validItems(FunctionPlanSchema, MAX_FUNCTIONS),
  budget: z
    .array(
      z.object({
        category: str(60),
        amount: z.number().nonnegative(),
        note: z.string().trim().max(200).default(""),
      }),
    )
    .min(3)
    .transform((l) => l.slice(0, 12)),
  budgetTips: strList(6),
  timeline: z
    .array(
      z.object({
        when: str(60),
        daysBefore: DaysBefore,
        tasks: z
          .array(TaskSchema)
          .min(1)
          .transform((l) => l.slice(0, 8)),
      }),
    )
    .min(3)
    .transform((l) => l.slice(0, 10)),
  vendors: z
    .array(
      z.object({
        type: str(60),
        priority: z.enum(["must-have", "nice-to-have"]),
        bookByDaysBefore: DaysBefore,
        questions: strList(5),
        brief: str(700),
      }),
    )
    .min(2)
    .transform((l) => l.slice(0, 10)),
  ideas: IdeasSchema,
  warnings: strList(5, 250),
});

export type Plan = z.infer<typeof PlanSchema>;

export const RefineReplySchema = PlanSchema.extend({
  newTotalBudget: z.number().nonnegative().default(0),
  newGuestCount: z.number().int().nonnegative().default(0),
  /** New event date (YYYY-MM-DD) if the host moved it, otherwise "". */
  newDate: z.string().trim().max(10).default(""),
  /** Short plain lines on what changed and which trade-offs were made. */
  changes: z.array(z.string().trim().min(1).max(220)).max(6).catch([]).default([]),
});

export function makeRefineSchema(now: Date = new Date()) {
  return z.object({
    input: makeEventInputSchema(now),
    plan: PlanSchema,
    instruction: z
      .string()
      .trim()
      .min(3, "Please describe what you want to change")
      .max(LIMITS.maxInstruction, `Please keep your request under ${LIMITS.maxInstruction} characters`)
      .regex(SAFE_TEXT, "Your request contains characters that are not allowed"),
  });
}

/** Converts a zod error into a simple { field: message } map for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
