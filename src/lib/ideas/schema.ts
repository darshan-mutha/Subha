import { z } from "zod";
import { SignatureSchema, clip, safeText } from "../schemas";
import { knownOnly } from "../validation";

/**
 * The Ideas section.
 *
 * The thought behind it: every celebration has a heart (who it is really for,
 * and how guests should feel). Ideas grow from that heart: heart → theme →
 * moments → details → into the plan. The host can always bring their own idea,
 * keep or skip what Shubā suggests, and add any idea to the plan as a task with
 * a budget and a vendor message. Claude writes the ideas; money moves in code.
 */

/* ------------------------------------------------------------------ */
/* The heart, chips and the host's choices.                            */
/* ------------------------------------------------------------------ */

export const FEELINGS = ["cosy", "grand", "fun", "spiritual", "elegant", "heartfelt"] as const;
export type Feeling = (typeof FEELINGS)[number];
export const FEELING_LABELS: Record<Feeling, string> = {
  cosy: "Cosy",
  grand: "Grand",
  fun: "Fun",
  spiritual: "Spiritual",
  elegant: "Elegant",
  heartfelt: "Heartfelt",
};

/** Starting points for the "Got an idea?" box. */
export const LEANINGS = ["budget", "eco", "kids", "elders", "traditional", "modern"] as const;
export type Leaning = (typeof LEANINGS)[number];
export const LEANING_LABELS: Record<Leaning, string> = {
  budget: "Budget-friendly",
  eco: "Eco-friendly",
  kids: "For kids",
  elders: "For elders",
  traditional: "Traditional touch",
  modern: "Modern twist",
};

export { knownOnly };

export const HeartSchema = z.object({
  /** Who it is really for, e.g. "Dadi's 80th" or "our daughter's first birthday". */
  forWhom: safeText(80, "Who it's for").catch("").default(""),
  feelings: knownOnly(FEELINGS, 3),
  /** The host's own idea or must-have. */
  own: safeText(300, "Your idea").catch("").default(""),
});
export type Heart = z.infer<typeof HeartSchema>;

const IdeaId = z.string().regex(/^i_[a-z0-9]{1,12}$/);
const idList = z.array(IdeaId).max(200).catch([]).default([]);

export const DirectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((v) => clip(v, 60)),
  mood: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .transform((v) => clip(v, 200)),
  colors: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .transform((l) => l.slice(0, 5))
    .pipe(z.array(z.object({ name: z.string(), hex: z.string() })).min(2)),
  decor: z
    .string()
    .trim()
    .max(300)
    .catch("")
    .default("")
    .transform((v) => clip(v, 200)),
  food: z
    .string()
    .trim()
    .max(300)
    .catch("")
    .default("")
    .transform((v) => clip(v, 200)),
  fun: z
    .string()
    .trim()
    .max(300)
    .catch("")
    .default("")
    .transform((v) => clip(v, 200)),
  signature: SignatureSchema,
  /** Whether the look fits the budget as it stands, or would stretch it. */
  fit: z.enum(["fits", "stretch"]).catch("fits"),
});
export type Direction = z.infer<typeof DirectionSchema>;

/** What the host has done in the Ideas section. Saved with the plan, shared with the team. */
export const IdeaStateSchema = z.object({
  heart: HeartSchema.catch({ forWhom: "", feelings: [], own: "" }).default({ forWhom: "", feelings: [], own: "" }),
  kept: idList,
  skipped: idList,
  added: idList,
  /** The last three theme directions, so the host can come back and compare. */
  directions: z.array(DirectionSchema).max(3).catch([]).default([]),
});
export type IdeaState = z.infer<typeof IdeaStateSchema>;

export const EMPTY_IDEA_STATE: IdeaState = {
  heart: { forWhom: "", feelings: [], own: "" },
  kept: [],
  skipped: [],
  added: [],
  directions: [],
};
