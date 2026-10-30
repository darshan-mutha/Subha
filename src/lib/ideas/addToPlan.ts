import { daysBetween } from "../dates";
import { formatINR } from "../money";
import { clip, type EventInput, type Idea, type Moment, type Plan, type Priority } from "../schemas";

/* ------------------------------------------------------------------ */
/* "Add to my plan": done in code, never by the AI.                    */
/* ------------------------------------------------------------------ */

/** Budget lines an idea's cost belongs to, best match first, by where it happens in the day. */
const LINE_FOR: Record<Moment, RegExp[]> = {
  arrival: [/decor|flower/i, /light|setup/i, /venue/i],
  welcome: [/decor|flower/i, /welcome|setup/i, /food|cater/i],
  main: [/ritual|pooja|puja|priest|ceremony|mandap/i, /decor|flower|stage/i],
  food: [/food|cater|meal|dinner|lunch/i, /drink|bever|cake|sweet/i],
  fun: [/entertain|music|dj|band|sangeet|perform|artist/i, /activit|game/i, /decor/i],
  "send-off": [/gift|favou?r|return/i, /decor/i],
};
const SPARE = /contingen|buffer|miscell|reserve|unforeseen/i;

/** Vendors that usually handle an idea, by where it happens. */
const VENDOR_FOR: Record<Moment, RegExp> = {
  arrival: /decor|florist|light/i,
  welcome: /decor|florist/i,
  main: /decor|florist|priest|pandit|photo/i,
  food: /cater|food|bak|chef/i,
  fun: /dj|music|band|entertain|choreo|anchor|artist/i,
  "send-off": /gift|decor|favou?r/i,
};

/** How many days before the event to do it, by effort. */
const LEAD_DAYS: Record<Idea["effort"], number> = { vendor: 30, help: 14, easy: 3 };

export interface AddResult {
  plan: Plan;
  /** Plain lines for "What changed". */
  lines: string[];
}

/**
 * Turns an idea into part of the plan: a task at a sensible time, its rough
 * cost moved into the right budget line (from the spare money, never more than
 * there is), and a line in the matching vendor's message.
 */
export function addIdeaToPlan(plan: Plan, input: EventInput, idea: Idea, today: string): AddResult {
  const lines: string[] = [];
  const label = clip(`${idea.title}${idea.forFunction ? ` (${idea.forFunction})` : ""}`, 190);

  // 1. Task, in the step nearest to the right lead time that still has room.
  const left = Math.max(0, daysBetween(today, input.date));
  const target = Math.min(LEAD_DAYS[idea.effort], left);
  const steps = plan.timeline.map((s, i) => ({ i, days: s.daysBefore ?? 0, room: s.tasks.length < 8 }));
  const fits = steps
    .filter((s) => s.room && s.days <= left)
    .sort((a, b) => Math.abs(a.days - target) - Math.abs(b.days - target));
  const timeline = plan.timeline.map((s) => ({ ...s, tasks: [...s.tasks] }));
  const priority: Priority = idea.effort === "easy" ? "low" : "medium";
  const task = { task: `Idea: ${label}`, priority, milestone: false };
  const already = timeline.some((s) => s.tasks.some((t) => t.task === task.task));
  if (!already && fits.length > 0) {
    timeline[fits[0].i].tasks.push(task);
    lines.push(`Added the task "${task.task}" to ${timeline[fits[0].i].when.toLowerCase()}.`);
  } else if (!already) {
    timeline.push({ when: "Event day", daysBefore: 0, tasks: [task] });
    lines.push(`Added the task "${task.task}" for the event day.`);
  }

  // 2. Budget: move the rough cost from spare money into the right line.
  let budget = plan.budget;
  const cost = Math.round(idea.cost / 100) * 100;
  if (cost > 0) {
    const target =
      LINE_FOR[idea.moment]
        .map((re) => budget.findIndex((l) => re.test(l.category) && !SPARE.test(l.category)))
        .find((i) => i >= 0) ?? -1;
    const spare = budget.findIndex((l) => SPARE.test(l.category));
    if (target < 0) {
      lines.push(`It costs about ${formatINR(cost)}. No budget line matched, so set this aside in the Budget section.`);
    } else {
      const moved = spare >= 0 ? Math.min(cost, budget[spare].amount) : 0;
      budget = budget.map((l, i) =>
        i === target ? { ...l, amount: l.amount + moved } : i === spare ? { ...l, amount: l.amount - moved } : l,
      );
      if (moved > 0)
        lines.push(`${budget[target].category}: +${formatINR(moved)}, taken from ${budget[spare].category}.`);
      if (moved < cost)
        lines.push(
          `${formatINR(cost - moved)} more is needed than you have spare. Raise the budget or move money in the Budget section.`,
        );
    }
  }

  // 3. Vendor message, if a vendor is needed and one matches.
  let vendors = plan.vendors;
  if (idea.effort === "vendor") {
    const v = vendors.findIndex((x) => VENDOR_FOR[idea.moment].test(x.type));
    if (v >= 0) {
      const extra = ` We would also like: ${idea.title}.`;
      if (!vendors[v].brief.includes(extra) && vendors[v].brief.length + extra.length <= 700) {
        vendors = vendors.map((x, i) => (i === v ? { ...x, brief: `${x.brief.trimEnd()}${extra}` } : x));
        lines.push(`Added it to the message for the ${vendors[v].type.toLowerCase()}.`);
      }
    }
  }

  return { plan: { ...plan, timeline, budget, vendors }, lines };
}
