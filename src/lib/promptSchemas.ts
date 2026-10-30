/**
 * The JSON shapes sent to Claude with each prompt (see ./prompt), so its
 * replies come back in exactly the shape Shubā checks with zod.
 */

/** The two halves of a new plan, written at the same time. */
export const PLAN_PARTS = {
  core: ["summary", "theme", "functions", "budget", "budgetTips", "timeline", "warnings"],
  extras: ["vendors", "ideas"],
} as const;
export type PlanPart = keyof typeof PLAN_PARTS;

/** JSON schema for one half of a new plan. */
export function planPartSchema(part: PlanPart) {
  const keys = PLAN_PARTS[part] as readonly string[];
  const properties = Object.fromEntries(
    Object.entries(PLAN_JSON_SCHEMA.properties).filter(([key]) => keys.includes(key)),
  );
  return { type: "object", properties, required: [...keys] } as const;
}

/** One idea, as Claude writes it. Shared with the Ideas section's own requests. */
export const IDEA_JSON = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short name of the idea, under 8 words" },
    detail: { type: "string", description: "1-2 sentences: what it is and how to do it" },
    why: { type: "string", description: "One line on why it suits this family, using their details" },
    moment: { type: "string", enum: ["arrival", "welcome", "main", "food", "fun", "send-off"] },
    forFunction: { type: "string", description: "Function name it belongs to, or empty for the whole event" },
    cost: { type: "number", description: "Rough cost in INR (estimate)" },
    effort: { type: "string", enum: ["easy", "help", "vendor"] },
  },
  required: ["title", "detail", "why", "moment", "forFunction", "cost", "effort"],
} as const;

export const SIGNATURE_JSON = {
  type: "object",
  description: "The one moment guests will talk about later",
  properties: { title: { type: "string" }, detail: { type: "string", description: "2 sentences" } },
  required: ["title", "detail"],
} as const;

/** JSON schema sent to Claude so it returns the exact shape Shubā expects. */
export const PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "2-3 sentence overview of the plan" },
    theme: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        colors: { type: "array", items: { type: "string" }, description: "3-5 colour names" },
        swatches: {
          type: "array",
          items: { type: "string" },
          description: "The same colours as #RRGGBB hex codes, in the same order",
        },
      },
      required: ["name", "description", "colors", "swatches"],
    },
    functions: {
      type: "array",
      description: "One entry per listed function, in order; empty if none are listed",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          day: { type: "integer", description: "1 = first day; 0 = before the main days" },
          time: { type: "string", description: "Time of day, e.g. Evening, 7-11 pm" },
          guests: { type: "integer" },
          amount: { type: "number", description: "Estimated cost in INR" },
          mood: { type: "string", description: "One line: the feel of this function within the theme" },
          rituals: { type: "array", items: { type: "string" }, description: "2-5 rituals usually done" },
          needs: {
            type: "array",
            items: { type: "string" },
            description: "What is needed: officiant, ritual items, attire",
          },
        },
        required: ["name", "day", "time", "guests", "amount", "mood", "rituals", "needs"],
      },
    },
    budget: {
      type: "array",
      description: "5-10 categories that add up to the total budget",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          amount: { type: "number" },
          note: { type: "string" },
        },
        required: ["category", "amount", "note"],
      },
    },
    budgetTips: { type: "array", items: { type: "string" }, description: "3-5 ways to save money" },
    timeline: {
      type: "array",
      description: "4-8 milestones from now until the event day",
      items: {
        type: "object",
        properties: {
          when: { type: "string" },
          daysBefore: { type: "integer", description: "Whole days before the event; 0 = event day" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                milestone: { type: "boolean", description: "true for 3-5 big moments only" },
              },
              required: ["task", "priority", "milestone"],
            },
          },
        },
        required: ["when", "daysBefore", "tasks"],
      },
    },
    vendors: {
      type: "array",
      description: "4-8 vendors needed",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          priority: { type: "string", enum: ["must-have", "nice-to-have"] },
          bookByDaysBefore: { type: "integer", description: "Book at least this many days before the event" },
          questions: { type: "array", items: { type: "string" }, description: "3 questions to ask" },
          brief: { type: "string", description: "Ready-to-send WhatsApp message" },
        },
        required: ["type", "priority", "bookByDaysBefore", "questions", "brief"],
      },
    },
    ideas: {
      type: "object",
      properties: {
        signature: SIGNATURE_JSON,
        items: { type: "array", description: "10-14 ideas over the guest's day", items: IDEA_JSON },
      },
      required: ["signature", "items"],
    },
    warnings: { type: "array", items: { type: "string" }, description: "0-4 risks; empty if none" },
  },
  required: ["summary", "theme", "functions", "budget", "budgetTips", "timeline", "vendors", "ideas", "warnings"],
} as const;

/** Step 1 of a change: the new facts only. */
export const REFINE_FACTS_JSON_SCHEMA = {
  type: "object",
  properties: {
    newTotalBudget: { type: "number", description: "New total budget in INR, or 0 if unchanged" },
    newGuestCount: { type: "integer", description: "New guest count, or 0 if unchanged" },
    newDate: { type: "string", description: "New event date YYYY-MM-DD, or empty if unchanged" },
  },
  required: ["newTotalBudget", "newGuestCount", "newDate"],
} as const;

/** Step 2 of a change: one half of the plan plus short notes on what changed. */
export function refinePartSchema(part: PlanPart) {
  const base = planPartSchema(part);
  return {
    ...base,
    properties: {
      ...base.properties,
      changes: { type: "array", items: { type: "string" }, description: "Short lines: what changed and trade-offs" },
    },
    required: [...base.required, "changes"],
  } as const;
}
