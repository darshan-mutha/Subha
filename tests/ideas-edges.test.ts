import { describe, expect, it } from "vitest";
import { addIdeaToPlan, buildIdeasPrompt, IdeasRequestSchema } from "@/lib/ideas";
import type { IdeasRequest } from "@/lib/ideas";
import type { Idea, Plan } from "@/lib/schemas";
import { baseInput, samplePlan } from "./fixtures";

const today = "2026-10-26"; // 47 days before baseInput's 12 Dec party

const idea = (title: string, extra: Partial<Idea> = {}): Idea => ({
  title,
  detail: "",
  why: "",
  moment: "main",
  forFunction: "",
  cost: 0,
  effort: "help",
  ...extra,
});

const tasksOf = (plan: Plan) => plan.timeline.flatMap((s) => s.tasks.map((t) => t.task));

/** A bare request: no optional details at all, so every "leave it out" branch is taken. */
const bare = (over: Record<string, unknown> = {}): IdeasRequest =>
  IdeasRequestSchema.parse({
    input: { ...baseInput, eventName: "", style: "", notes: "" },
    context: {},
    heart: {},
    mode: "more",
    ...over,
  });

describe("addIdeaToPlan timeline edge cases", () => {
  it("creates an event-day step when the plan has no timeline yet", () => {
    const plan = { ...samplePlan, timeline: [] };
    const { plan: next, lines } = addIdeaToPlan(plan, baseInput, idea("Rangoli"), today);
    expect(next.timeline).toEqual([
      { when: "Event day", daysBefore: 0, tasks: [{ task: "Idea: Rangoli", priority: "medium", milestone: false }] },
    ]);
    expect(lines[0]).toBe('Added the task "Idea: Rangoli" for the event day.');
  });

  it("creates an event-day step when every existing step is full", () => {
    const full = Array.from({ length: 8 }, (_, i) => ({ task: `T${i}`, priority: "low" as const, milestone: false }));
    const plan = { ...samplePlan, timeline: [{ when: "1 week before", daysBefore: 7, tasks: full }] };
    const { plan: next } = addIdeaToPlan(plan, baseInput, idea("Rangoli", { effort: "easy" }), today);
    expect(next.timeline).toHaveLength(2);
    expect(next.timeline[0].tasks).toHaveLength(8);
    expect(next.timeline[1]).toMatchObject({ when: "Event day", tasks: [{ priority: "low" }] });
  });

  it("treats a step with no day count as the event day", () => {
    const plan = {
      ...samplePlan,
      timeline: [{ when: "On the day", daysBefore: null, tasks: [] }],
    } as unknown as Plan;
    const { plan: next } = addIdeaToPlan(plan, baseInput, idea("Rangoli"), today);
    expect(next.timeline).toHaveLength(1);
    expect(next.timeline[0].tasks.map((t) => t.task)).toEqual(["Idea: Rangoli"]);
  });

  it("does not add the same task twice, even when no step has room", () => {
    const plan = { ...samplePlan, timeline: [] };
    const first = addIdeaToPlan(plan, baseInput, idea("Rangoli"), today);
    const again = addIdeaToPlan(first.plan, baseInput, idea("Rangoli"), today);
    expect(tasksOf(again.plan).filter((t) => t === "Idea: Rangoli")).toHaveLength(1);
    expect(again.lines).toEqual([]);
  });

  it("only uses steps that are not further back than the days left", () => {
    // Only two days to go: the "4 weeks before" step is in the past.
    const { plan } = addIdeaToPlan(samplePlan, baseInput, idea("Arch", { effort: "vendor" }), "2026-12-10");
    const step = plan.timeline.find((s) => s.tasks.some((t) => t.task === "Idea: Arch"));
    expect(step?.when).toBe("Event day");
  });
});

describe("addIdeaToPlan budget edge cases", () => {
  it("asks for the whole cost when the plan has no spare-money line", () => {
    const plan = { ...samplePlan, budget: samplePlan.budget.filter((l) => l.category !== "Contingency") };
    const { plan: next, lines } = addIdeaToPlan(
      plan,
      baseInput,
      idea("Flower arch", { moment: "arrival", cost: 1200 }),
      today,
    );
    expect(next.budget).toEqual(plan.budget);
    expect(lines.some((l) => l.includes("taken from"))).toBe(false);
    expect(lines.join(" ")).toMatch(/₹1,200 more is needed/);
  });

  it("rounds the cost to the nearest hundred and skips the budget when it rounds to zero", () => {
    const { plan, lines } = addIdeaToPlan(
      samplePlan,
      baseInput,
      idea("Paper fans", { moment: "fun", cost: 40 }),
      today,
    );
    expect(plan.budget).toEqual(samplePlan.budget);
    expect(lines).toHaveLength(1);
  });

  it("leaves vendor messages alone when no vendor matches", () => {
    const { plan, lines } = addIdeaToPlan(
      samplePlan,
      baseInput,
      idea("Flower arch", { moment: "arrival", effort: "vendor" }),
      today,
    );
    expect(plan.vendors).toEqual(samplePlan.vendors);
    expect(lines.some((l) => l.includes("message for"))).toBe(false);
  });

  it("does not add to a vendor message that would grow past 700 characters", () => {
    const long = "x".repeat(690);
    const plan = { ...samplePlan, vendors: [{ ...samplePlan.vendors[0], brief: long }] };
    const { plan: next } = addIdeaToPlan(
      plan,
      baseInput,
      idea("Kulfi cart", { moment: "food", effort: "vendor" }),
      today,
    );
    expect(next.vendors[0].brief).toBe(long);
  });
});

describe("buildIdeasPrompt with few details", () => {
  it("leaves out every optional line when the host gave nothing extra", () => {
    const prompt = buildIdeasPrompt(bare());
    for (const missing of [
      "Event name:",
      "Style the host asked for:",
      "What matters most:",
      "Food rule:",
      "Guest needs:",
      "Host notes:",
      "Current theme:",
      "Budget lines:",
      "Planned functions:",
      "Who it is really for:",
      "How guests should feel:",
      "own idea or must-have",
      "Lean towards",
      "Do not repeat",
      "set forFunction",
    ]) {
      expect(prompt).not.toContain(missing);
    }
    expect(prompt).toContain("City: Bengaluru");
    expect(prompt).toContain("Suggest 4-6 ideas that build on what the host wants. Make them");
  });

  it("mentions the host's own idea when asking for more without a seed", () => {
    const prompt = buildIdeasPrompt(bare({ heart: { own: "a puppet show" } }));
    expect(prompt).toContain("build on what the host wants (their own idea above)");
  });

  it("includes focus areas, guest needs and the budget lines when given", () => {
    const prompt = buildIdeasPrompt(
      bare({
        input: { ...baseInput, focus: ["food", "decor"], guestNeeds: ["wheelchair"] },
        context: { budget: [{ category: "Food", amount: 20000 }] },
      }),
    );
    expect(prompt).toMatch(/What matters most: .+, .+/);
    expect(prompt).toContain("Guest needs:");
    expect(prompt).toContain("Budget lines: Food ₹20,000");
  });

  it("lists functions with their mood only when one is given", () => {
    const prompt = buildIdeasPrompt(
      bare({
        context: {
          functions: [
            { name: "Mehendi", day: 1, mood: "Bright and musical" },
            { name: "Pooja", day: 2, mood: "" },
          ],
        },
      }),
    );
    expect(prompt).toContain("Planned functions: Mehendi (day 1, Bright and musical); Pooja (day 2)");
  });

  it("falls back to the current theme when asked for ideas with no chosen direction", () => {
    const prompt = buildIdeasPrompt(bare({ mode: "ideas" }));
    expect(prompt).toContain("The family chose this theme direction: the current theme.");
    expect(prompt).not.toContain("Spread them across the functions");
  });

  it("asks to spread ideas across functions for multi-day events", () => {
    const prompt = buildIdeasPrompt(bare({ mode: "ideas", input: { ...baseInput, days: 3 } }));
    expect(prompt).toContain("Spread them across the functions and set forFunction for each.");
  });

  it("asks to spread ideas across functions when functions are planned for a one-day event", () => {
    const prompt = buildIdeasPrompt(
      bare({ mode: "ideas", context: { functions: [{ name: "Haldi", day: 1, mood: "" }] } }),
    );
    expect(prompt).toContain("Spread them across the functions");
  });
});
