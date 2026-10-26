import { formatINR, localWarnings, mergeWarnings, normalizeBudget } from "./budget";
import { generateStructured, claudeGenerator, type TextGenerator } from "./ai";
import { findLocation } from "./locations";
import { normalizeTimeline } from "./schedule";
import { calculateTimings, type DayTimings } from "./muhurat";
import {
  REFINE_JSON_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildPlanPartPrompt,
  buildRefinePrompt,
  planPartSchema,
  type PlanPart,
} from "./prompt";
import {
  LIMITS,
  PlanSchema,
  RefineReplySchema,
  makeEventInputSchema,
  todayIST,
  type EventInput,
  type Plan,
} from "./schemas";

export interface PlanResult {
  input: EventInput;
  plan: Plan;
  timings: DayTimings | null;
  /** After a change request: plain lines on what changed (facts first, then the AI's notes). */
  changes?: string[];
}

export interface PlannerDeps {
  generate?: TextGenerator;
  locate?: typeof findLocation;
  now?: Date;
}

/** Applies checks that the AI must not be trusted with: totals and warnings. */
function finalize(plan: Plan, input: EventInput, now: Date): Plan {
  return {
    ...normalizeTimeline(plan, input.date, todayIST(now)),
    budget: normalizeBudget(plan.budget, input.budget),
    functions: normalizeFunctions(plan.functions, input),
    warnings: mergeWarnings(localWarnings(input, now), plan.warnings),
  };
}

/**
 * Function costs are scaled to add up to the total budget (another view of the
 * same money), days stay within the event's days and guests within the guest list.
 */
export function normalizeFunctions(list: Plan["functions"], input: EventInput): Plan["functions"] {
  if (list.length === 0) return list;
  const days = Math.max(1, input.days ?? 1);
  const fixed = list.map((f) => ({
    ...f,
    day: Math.min(f.day, days),
    guests: Math.min(f.guests > 0 ? f.guests : input.guests, input.guests),
  }));
  const sum = fixed.reduce((acc, f) => acc + f.amount, 0);
  if (sum <= 0) return fixed;
  const scaled = fixed.map((f) => ({ ...f, amount: Math.round(((f.amount / sum) * input.budget) / 100) * 100 }));
  const diff = input.budget - scaled.reduce((acc, f) => acc + f.amount, 0);
  let largest = 0;
  scaled.forEach((f, i) => {
    if (f.amount > scaled[largest].amount) largest = i;
  });
  scaled[largest] = { ...scaled[largest], amount: Math.max(0, scaled[largest].amount + diff) };
  return scaled;
}

async function timingsFor(input: EventInput, locate: typeof findLocation): Promise<DayTimings | null> {
  if (!input.includeMuhurat) return null;
  const location = await locate(input.city);
  return location ? calculateTimings(input.date, location) : null;
}

/** Accepts a number suggested by the AI only if it is within Shubā's limits. */
function withinLimits(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** The two halves of a new plan (see PLAN_PARTS in prompt.ts). */
const CoreSchema = PlanSchema.pick({
  summary: true,
  theme: true,
  functions: true,
  budget: true,
  budgetTips: true,
  timeline: true,
  warnings: true,
});
const ExtrasSchema = PlanSchema.pick({ vendors: true, ideas: true });

export async function createPlan(input: EventInput, deps: PlannerDeps = {}): Promise<PlanResult> {
  const now = deps.now ?? new Date();
  const generate = deps.generate ?? claudeGenerator;
  const locate = deps.locate ?? findLocation;
  // The plan is written as two halves at the same time, alongside the location lookup.
  const request = (name: PlanPart) => ({
    system: SYSTEM_INSTRUCTION,
    prompt: buildPlanPartPrompt(input, todayIST(now), name),
    jsonSchema: planPartSchema(name),
    maxTokens: 8_000,
  });
  const [core, extras, timings] = await Promise.all([
    generateStructured(request("core"), CoreSchema, generate),
    generateStructured(request("extras"), ExtrasSchema, generate),
    timingsFor(input, locate),
  ]);
  const plan: Plan = { ...core, ...extras };
  return { input, plan: finalize(plan, input, now), timings };
}

export async function refinePlan(
  input: EventInput,
  current: Plan,
  instruction: string,
  deps: PlannerDeps = {},
): Promise<PlanResult> {
  const now = deps.now ?? new Date();
  const generate = deps.generate ?? claudeGenerator;
  const locate = deps.locate ?? findLocation;
  const [reply, timings] = await Promise.all([
    generateStructured(
      {
        system: SYSTEM_INSTRUCTION,
        prompt: buildRefinePrompt(input, current, instruction, todayIST(now)),
        jsonSchema: REFINE_JSON_SCHEMA,
      },
      RefineReplySchema,
      generate,
    ),
    timingsFor(input, locate),
  ]);

  const { newTotalBudget, newGuestCount, newDate, changes, ...plan } = reply;
  // A new date is only accepted if it passes the same rules as the form (real, not past, within limits).
  const dateOk = newDate !== "" && makeEventInputSchema(now).shape.date.safeParse(newDate).success;
  const updated: EventInput = {
    ...input,
    budget: withinLimits(newTotalBudget, LIMITS.minBudget, LIMITS.maxBudget)
      ? Math.round(newTotalBudget)
      : input.budget,
    guests: withinLimits(newGuestCount, LIMITS.minGuests, LIMITS.maxGuests) ? newGuestCount : input.guests,
    date: dateOk ? newDate : input.date,
  };
  // The date moved, so auspicious timings must be worked out for the new day.
  const dayTimings = updated.date === input.date ? timings : await timingsFor(updated, locate);
  return {
    input: updated,
    plan: finalize(plan, updated, now),
    timings: dayTimings,
    changes: [...factChanges(input, updated), ...changes].slice(0, 8),
  };
}

function shortDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Changes Shubā can state for certain, without trusting the AI. */
export function factChanges(before: EventInput, after: EventInput): string[] {
  const out: string[] = [];
  if (before.date !== after.date) out.push(`Date moved from ${shortDay(before.date)} to ${shortDay(after.date)}`);
  if (before.guests !== after.guests)
    out.push(`Guests: ${before.guests.toLocaleString("en-IN")} → ${after.guests.toLocaleString("en-IN")}`);
  if (before.budget !== after.budget)
    out.push(`Total budget: ${formatINR(before.budget)} → ${formatINR(after.budget)}`);
  return out;
}
