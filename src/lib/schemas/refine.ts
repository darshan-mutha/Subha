import { z } from "zod";
import { SAFE_TEXT } from "../validation";
import { LIMITS, makeEventInputSchema } from "./eventInput";
import { PlanSchema } from "./plan";

/** A change request ("make it cheaper", "move it to Sunday") and the AI's reply to one. */

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
