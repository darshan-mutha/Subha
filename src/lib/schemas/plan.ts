import { z } from "zod";
import { MAX_DAYS, MAX_FUNCTIONS } from "../traditions";
import { validList } from "../validation";
import { IdeasSchema } from "./ideas";
import { clip, str, strList } from "./text";

/* ------------------------------------------------------------------ */
/* Plan returned by the AI. Validated before it ever reaches the UI.   */
/* ------------------------------------------------------------------ */

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
  .catch([]);

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
  functions: validList(FunctionPlanSchema, MAX_FUNCTIONS).default([]),
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
