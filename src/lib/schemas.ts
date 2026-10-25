import { z } from "zod";

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

const safeText = (max: number, label: string) =>
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
  });
}

export type EventInput = z.infer<ReturnType<typeof makeEventInputSchema>>;

/* ------------------------------------------------------------------ */
/* Plan returned by the AI. Validated before it ever reaches the UI.   */
/* ------------------------------------------------------------------ */

const str = (max = 400) => z.string().trim().min(1).max(max);
const strList = (maxItems: number, max = 200) => z.array(str(max)).max(maxItems).default([]);

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

export const PlanSchema = z.object({
  summary: str(600),
  theme: z.object({
    name: str(80),
    description: str(400),
    colors: strList(5, 40),
  }),
  budget: z
    .array(
      z.object({
        category: str(60),
        amount: z.number().nonnegative(),
        note: z.string().trim().max(200).default(""),
      }),
    )
    .min(3)
    .max(12),
  budgetTips: strList(6),
  timeline: z
    .array(
      z.object({
        when: str(60),
        daysBefore: DaysBefore,
        tasks: z.array(TaskSchema).min(1).max(8),
      }),
    )
    .min(3)
    .max(10),
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
    .max(10),
  ideas: z.object({
    decor: strList(6),
    food: strList(6),
    activities: strList(6),
    extras: strList(6),
  }),
  warnings: strList(5, 250),
});

export type Plan = z.infer<typeof PlanSchema>;

export const RefineReplySchema = PlanSchema.extend({
  newTotalBudget: z.number().nonnegative().default(0),
  newGuestCount: z.number().int().nonnegative().default(0),
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
