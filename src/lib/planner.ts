import { formatINR, localWarnings, mergeWarnings, normalizeBudget } from "./budget";
import { generateStructured, claudeGenerator, type TextGenerator } from "./ai";
import { findLocation } from "./locations";
import { scaleToTotal } from "./scale";
import { shortDate } from "./dates";
import { normalizeTimeline } from "./schedule";
import { calculateTimings, type DayTimings } from "./muhurat";
import {
  REFINE_FACTS_JSON_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildPlanPartPrompt,
  buildRefineFactsPrompt,
  buildRefinePrompt,
  planPartSchema,
  refinePartSchema,
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
  const amounts = scaleToTotal(
    fixed.map((f) => f.amount),
    input.budget,
    { step: 100 },
  );
  return fixed.map((f, i) => ({ ...f, amount: amounts[i] }));
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

/** Step 1 of a change: only the new facts. */
const FactsSchema = RefineReplySchema.pick({ newTotalBudget: true, newGuestCount: true, newDate: true });
/** Step 2 of a change: each half of the plan plus notes on what changed. */
const ChangeNotes = RefineReplySchema.pick({ changes: true });
const RefineCoreSchema = CoreSchema.extend(ChangeNotes.shape);
const RefineExtrasSchema = ExtrasSchema.extend(ChangeNotes.shape);

/**
 * Changes a plan without starting again. A short first call settles the new
 * budget, guests and date (checked in code); then both halves of the plan are
 * rewritten at the same time with those facts.
 */
export async function refinePlan(
  input: EventInput,
  current: Plan,
  instruction: string,
  deps: PlannerDeps = {},
): Promise<PlanResult> {
  const now = deps.now ?? new Date();
  const today = todayIST(now);
  const generate = deps.generate ?? claudeGenerator;
  const locate = deps.locate ?? findLocation;

  const facts = await generateStructured(
    {
      system: SYSTEM_INSTRUCTION,
      prompt: buildRefineFactsPrompt(input, instruction, today),
      jsonSchema: REFINE_FACTS_JSON_SCHEMA,
      maxTokens: 1_000,
    },
    FactsSchema,
    generate,
  );
  // A new date is only accepted if it passes the same rules as the form (real, not past, within limits).
  const dateOk = facts.newDate !== "" && makeEventInputSchema(now).shape.date.safeParse(facts.newDate).success;
  const updated: EventInput = {
    ...input,
    budget: withinLimits(facts.newTotalBudget, LIMITS.minBudget, LIMITS.maxBudget)
      ? Math.round(facts.newTotalBudget)
      : input.budget,
    guests: withinLimits(facts.newGuestCount, LIMITS.minGuests, LIMITS.maxGuests) ? facts.newGuestCount : input.guests,
    date: dateOk ? facts.newDate : input.date,
  };
  const settled = factChanges(input, updated);

  const request = (part: PlanPart) => ({
    system: SYSTEM_INSTRUCTION,
    prompt: buildRefinePrompt(updated, current, instruction, today, part, settled),
    jsonSchema: refinePartSchema(part),
    maxTokens: 8_000,
  });
  const [core, extras, timings] = await Promise.all([
    generateStructured(request("core"), RefineCoreSchema, generate),
    generateStructured(request("extras"), RefineExtrasSchema, generate),
    timingsFor(updated, locate),
  ]);
  const { changes: coreNotes, ...corePlan } = core;
  const { changes: extraNotes, ...extrasPlan } = extras;
  const plan: Plan = { ...corePlan, ...extrasPlan };
  return {
    input: updated,
    plan: finalize(plan, updated, now),
    timings,
    changes: [...new Set([...settled, ...coreNotes, ...extraNotes])].slice(0, 8),
  };
}

/** Changes Shubā can state for certain, without trusting the AI. */
export function factChanges(before: EventInput, after: EventInput): string[] {
  const out: string[] = [];
  if (before.date !== after.date) out.push(`Date moved from ${shortDate(before.date)} to ${shortDate(after.date)}`);
  if (before.guests !== after.guests)
    out.push(`Guests: ${before.guests.toLocaleString("en-IN")} → ${after.guests.toLocaleString("en-IN")}`);
  if (before.budget !== after.budget)
    out.push(`Total budget: ${formatINR(before.budget)} → ${formatINR(after.budget)}`);
  return out;
}
