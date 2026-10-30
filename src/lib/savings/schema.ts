import { z } from "zod";
import { LIMITS, StoredEventInputSchema, PlanSchema } from "../schemas";
import { UNSAFE_CHARS } from "../validation";

/**
 * "Over budget? See your choices." When bookings cost more than planned, or the
 * host simply needs to spend less, Shubā offers a few different ways out with
 * an estimated saving and what each one affects. The host picks one; applying
 * it goes through the normal change flow (What changed + Undo).
 *
 * Raising the budget is worked out in code. The other choices are suggested by
 * Claude for this event, with a plain-code fallback if the AI is busy.
 */

export const SAVING_KINDS = [
  "raise-budget",
  "cheaper-options",
  "drop-extras",
  "fewer-guests",
  "change-venue",
  "move-date",
  "fewer-functions",
  "family-help",
  "bundle-vendors",
] as const;
export type SavingKind = (typeof SAVING_KINDS)[number];

/** Short labels shown on each choice. */
export const SAVING_KIND_LABELS: Record<SavingKind, string> = {
  "raise-budget": "Increase the budget",
  "cheaper-options": "Cheaper options",
  "drop-extras": "Drop extras",
  "fewer-guests": "Fewer guests",
  "change-venue": "Change venue",
  "move-date": "Move the date",
  "fewer-functions": "Fewer functions",
  "family-help": "Family helps",
  "bundle-vendors": "One vendor for more",
};

/**
 * "cover": bookings went over their budget lines; free money elsewhere so the
 * total stays the same. "cut": the host wants to spend less overall.
 */
export const SAVING_MODES = ["cover", "cut"] as const;
export type SavingMode = (typeof SAVING_MODES)[number];

/** Instructions are sent back through the change-request route, so they follow its rules. */
export function cleanInstruction(text: string): string {
  return text.replace(UNSAFE_CHARS, "").replace(/\s+/g, " ").trim().slice(0, LIMITS.maxInstruction);
}

const tidy = (max: number) =>
  z
    .string()
    .transform((v) =>
      v
        .replace(/[<>{}`\\]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .pipe(z.string().min(1).max(max));

export const SavingOptionSchema = z.object({
  kind: z.enum(SAVING_KINDS),
  title: tidy(80),
  detail: tidy(260),
  /** Estimated saving in rupees. Always an estimate. */
  saving: z.number().min(0).max(LIMITS.maxBudget),
  /** What the host gives up, in plain words. */
  affects: tidy(180),
  /** The change request that applies this choice. Empty for raise-budget, which code applies. */
  instruction: z.string().transform(cleanInstruction).pipe(z.string().max(LIMITS.maxInstruction)),
});
export type SavingOption = z.infer<typeof SavingOptionSchema>;

const OverLineSchema = z.object({
  category: z.string().trim().min(1).max(60),
  over: z.number().min(1).max(LIMITS.maxBudget),
});
export type OverLine = z.infer<typeof OverLineSchema>;

export const SavingsRequestSchema = z.object({
  /** Allows past dates: a plan stays useful up to and on the day. */
  input: StoredEventInputSchema,
  budget: PlanSchema.shape.budget,
  vendors: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  mode: z.enum(SAVING_MODES),
  need: z.coerce
    .number({ message: "Please enter how much you need to save" })
    .min(100, "Please enter at least ₹100")
    .max(LIMITS.maxBudget, "Amount is too large"),
  overLines: z.array(OverLineSchema).max(12).default([]),
});
export type SavingsRequest = z.infer<typeof SavingsRequestSchema>;
