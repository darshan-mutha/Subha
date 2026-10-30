import { z } from "zod";
import { isRealDate, todayIST } from "../dates";
import { MAX_DAYS, MAX_FUNCTIONS, MODERN_ADDITIONS, TRADITIONS } from "../traditions";
import { knownValues, SAFE_TEXT } from "../validation";
import { FOCUS_AREAS, GUEST_NEEDS, EVENT_TYPES, FOOD_PREFS, MAX_FOCUS } from "./choices";

/**
 * The event details the host gives: checked on the form and again on the
 * server, with the same rules.
 */

/** Keeps known values only, without duplicates, so old or odd input never breaks a plan. */
function choiceList<T extends string>(values: readonly T[], max: number) {
  return z
    .array(z.string())
    .default([])
    .transform((list) => knownValues(list, values))
    .pipe(z.array(z.enum(values)).max(max, `Choose up to ${max}`));
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

const CITY_TEXT = /^[\p{L}\p{M}\s.,'\-()]+$/u;

export const safeText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .regex(SAFE_TEXT, `${label} contains characters that are not allowed`);

export { todayIST };

function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(y) + years}-${m}-${d}`;
}

export interface EventInputSchemaOptions {
  /**
   * Accept dates already in the past. Used for saved and shared plans, which
   * stay useful up to and on the day (and after it).
   */
  allowPast?: boolean;
}

/** The event date: a real date, not in the past (unless allowed) and within the years Shubā plans ahead. */
function eventDateSchema(today: () => string, allowPast: boolean) {
  const date = z.string().trim().refine(isRealDate, "Please enter a valid date");
  const notPast = allowPast ? date : date.refine((v) => v >= today(), "The event date cannot be in the past");
  return notPast.refine(
    (v) => v <= addYears(today(), LIMITS.maxYearsAhead),
    `Please choose a date within ${LIMITS.maxYearsAhead} years`,
  );
}

/**
 * The event form's rules. `now` fixes "today" for the not-in-the-past and
 * years-ahead checks; pass `{ allowPast: true }` for plans already saved.
 */
export function makeEventInputSchema(now: Date = new Date(), options: EventInputSchemaOptions = {}) {
  const today = todayIST(now);
  return eventInputSchema(() => today, options.allowPast ?? false);
}

function eventInputSchema(today: () => string, allowPast: boolean) {
  return z.object({
    eventType: z.enum(EVENT_TYPES, { message: "Please choose an event type" }),
    eventName: safeText(80, "Event name").optional().default(""),
    date: eventDateSchema(today, allowPast),
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

/**
 * Event details of a plan already saved or shared: the same rules as the form,
 * except the date may be in the past. "Today" is read on each check, never
 * frozen when the module loads.
 */
export const StoredEventInputSchema = eventInputSchema(() => todayIST(), true);

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
