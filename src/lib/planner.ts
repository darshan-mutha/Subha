import { localWarnings, mergeWarnings, normalizeBudget } from "./budget";
import { generateStructured, geminiGenerator, type TextGenerator } from "./gemini";
import { findLocation } from "./locations";
import { normalizeTimeline } from "./schedule";
import { calculateTimings, type DayTimings } from "./muhurat";
import { PLAN_JSON_SCHEMA, REFINE_JSON_SCHEMA, SYSTEM_INSTRUCTION, buildPlanPrompt, buildRefinePrompt } from "./prompt";
import { LIMITS, PlanSchema, RefineReplySchema, todayIST, type EventInput, type Plan } from "./schemas";

export interface PlanResult {
  input: EventInput;
  plan: Plan;
  timings: DayTimings | null;
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
    warnings: mergeWarnings(localWarnings(input, now), plan.warnings),
  };
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

export async function createPlan(input: EventInput, deps: PlannerDeps = {}): Promise<PlanResult> {
  const now = deps.now ?? new Date();
  const generate = deps.generate ?? geminiGenerator;
  const locate = deps.locate ?? findLocation;
  // The AI call and the location lookup are independent, so run them together.
  const [plan, timings] = await Promise.all([
    generateStructured(
      { system: SYSTEM_INSTRUCTION, prompt: buildPlanPrompt(input, todayIST(now)), jsonSchema: PLAN_JSON_SCHEMA },
      PlanSchema,
      generate,
    ),
    timingsFor(input, locate),
  ]);
  return { input, plan: finalize(plan, input, now), timings };
}

export async function refinePlan(
  input: EventInput,
  current: Plan,
  instruction: string,
  deps: PlannerDeps = {},
): Promise<PlanResult> {
  const now = deps.now ?? new Date();
  const generate = deps.generate ?? geminiGenerator;
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

  const { newTotalBudget, newGuestCount, ...plan } = reply;
  const updated: EventInput = {
    ...input,
    budget: withinLimits(newTotalBudget, LIMITS.minBudget, LIMITS.maxBudget)
      ? Math.round(newTotalBudget)
      : input.budget,
    guests: withinLimits(newGuestCount, LIMITS.minGuests, LIMITS.maxGuests) ? newGuestCount : input.guests,
  };
  return { input: updated, plan: finalize(plan, updated, now), timings };
}
