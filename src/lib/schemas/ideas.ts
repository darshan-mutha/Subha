import { z } from "zod";
import { validList } from "../validation";
import { clip, str } from "./text";

/** The plan's ideas: where each happens, how much work it is, and the one signature moment. */

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
  items: validList(IdeaSchema, 40).default([]),
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
