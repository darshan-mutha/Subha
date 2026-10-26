import { describe, expect, it, vi } from "vitest";
import { PlannerError } from "@/lib/ai";
import {
  addIdeaToPlan,
  buildIdeasPrompt,
  byMoment,
  carryChosen,
  ideaId,
  ideasContext,
  IdeasRequestSchema,
  IdeaStateSchema,
  mergeIdeas,
  suggestIdeas,
  themeSwatches,
  tidyText,
  type IdeasRequest,
} from "@/lib/ideas";
import { PlanSchema, type Idea } from "@/lib/schemas";
import { makeSharedContentSchema } from "@/lib/team";
import { baseInput, NOW, samplePlan } from "./fixtures";

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

const direction = {
  name: "Garden of Lights",
  mood: "Soft fairy lights and marigolds under the trees.",
  colors: [
    { name: "Marigold", hex: "#E8A317" },
    { name: "Leaf green", hex: "#2E7D4F" },
  ],
  decor: "Marigold strings",
  food: "Live chaat counters",
  fun: "Dhol at the entry",
  signature: { title: "Lantern release", detail: "Paper lanterns at dusk." },
  fit: "fits",
};

const request = (over: Partial<IdeasRequest> = {}): IdeasRequest =>
  IdeasRequestSchema.parse({
    input: { ...baseInput, food: "jain", guestNeeds: ["elderly"], traditions: ["tamil"] },
    context: ideasContext(samplePlan),
    heart: { forWhom: "Aarav, our little explorer", feelings: ["fun", "cosy"], own: "a mini zoo corner" },
    mode: "more",
    ...over,
  });

describe("ideas in a plan", () => {
  it("reads plans saved with the old four lists", () => {
    const plan = PlanSchema.parse({
      ...samplePlan,
      ideas: { decor: ["Leaf garlands"], food: ["Fruit cups"], activities: ["Treasure hunt"], extras: ["Seed paper"] },
    });
    expect(plan.ideas.signature).toBeNull();
    expect(plan.ideas.items.map((i) => [i.title, i.moment])).toEqual([
      ["Leaf garlands", "welcome"],
      ["Fruit cups", "food"],
      ["Treasure hunt", "fun"],
      ["Seed paper", "send-off"],
    ]);
  });

  it("keeps the new shape, fixing odd values and dropping only broken ideas", () => {
    const plan = PlanSchema.parse({
      ...samplePlan,
      ideas: {
        signature: { title: "Dadi's blessing circle", detail: "Grandchildren sit around Dadi." },
        items: [
          { title: "Marigold arch", moment: "arrival", effort: "vendor", cost: 8000, why: "Bright welcome" },
          { title: "", moment: "fun" },
          { title: "Paan station", moment: "dessert", effort: "lots", cost: -5 },
        ],
      },
    });
    expect(plan.ideas.signature?.title).toBe("Dadi's blessing circle");
    expect(plan.ideas.items).toHaveLength(2);
    expect(plan.ideas.items[1]).toMatchObject({ moment: "main", effort: "help", cost: 0 });
  });

  it("drops colours that are not hex codes", () => {
    const plan = PlanSchema.parse({ ...samplePlan, theme: { ...samplePlan.theme, swatches: ["#123ABC", "red", 5] } });
    expect(plan.theme.swatches).toEqual(["#123ABC"]);
  });
});

describe("idea helpers", () => {
  it("gives ideas stable ids from their titles", () => {
    expect(ideaId(idea("Marigold arch"))).toBe(ideaId(idea("  marigold ARCH ")));
    expect(ideaId(idea("Marigold arch"))).toMatch(/^i_[a-z0-9]+$/);
  });

  it("groups by the guest's day, hiding skipped ideas and filtering by function", () => {
    const items = [
      idea("Send-off sparklers", { moment: "send-off" }),
      idea("Welcome drinks", { moment: "welcome", forFunction: "Mehendi" }),
      idea("Dhol", { moment: "arrival", forFunction: "Sangeet" }),
    ];
    expect(byMoment(items, []).map(([m]) => m)).toEqual(["arrival", "welcome", "send-off"]);
    expect(byMoment(items, [ideaId(items[2])]).map(([m]) => m)).toEqual(["welcome", "send-off"]);
    expect(byMoment(items, [], "mehendi").map(([, l]) => l[0].title)).toEqual(["Welcome drinks"]);
  });

  it("adds new ideas without repeats", () => {
    const out = mergeIdeas([idea("A"), idea("B")], [idea("b"), idea("C")]);
    expect(out.map((i) => i.title)).toEqual(["A", "B", "C"]);
  });

  it("keeps the host's kept and added ideas when the plan is rewritten", () => {
    const before = [idea("Kept one"), idea("Added one"), idea("Other")];
    const after = [idea("New one")];
    const state = { kept: [ideaId(before[0])], added: [ideaId(before[1])] };
    expect(carryChosen(before, after, state).map((i) => i.title)).toEqual(["Kept one", "Added one", "New one"]);
  });

  it("shows colour dots from hex codes, or a best match for colour names", () => {
    expect(themeSwatches({ name: "x", description: "y", colors: ["Peacock blue"], swatches: ["#111111"] })).toEqual([
      { name: "Peacock blue", hex: "#111111" },
    ]);
    const named = themeSwatches({ name: "x", description: "y", colors: ["Deep marigold", "Mauve-ish"], swatches: [] });
    expect(named).toEqual([{ name: "Deep marigold", hex: "#E8A317" }]);
  });

  it("tidies phone-typed text so it passes Shubā's text rules", () => {
    expect(tidyText("Dadi’s “garden” – party 🎉 <b>", 80)).toBe(`Dadi's "garden" - party b`);
  });

  it("saves the host's choices safely", () => {
    const state = IdeaStateSchema.parse({ kept: ["i_abc", "bad id"], heart: { feelings: ["fun", "angry"] } });
    expect(state.kept).toEqual([]);
    expect(state.heart.feelings).toEqual(["fun"]);
    const content = makeSharedContentSchema(NOW).parse({
      input: baseInput,
      plan: samplePlan,
      ideaState: { kept: ["i_abc"], directions: [direction] },
    });
    expect(content.ideaState?.kept).toEqual(["i_abc"]);
    expect(content.ideaState?.directions[0].name).toBe("Garden of Lights");
  });
});

describe("adding an idea to the plan", () => {
  const today = "2026-10-26"; // the party is on 12 Dec, 47 days away

  it("adds a task at the right time and moves the cost from spare money", () => {
    const { plan, lines } = addIdeaToPlan(
      samplePlan,
      baseInput,
      idea("Marigold arch", { moment: "arrival", effort: "vendor", cost: 1500 }),
      today,
    );
    const step = plan.timeline.find((s) => s.tasks.some((t) => t.task === "Idea: Marigold arch"));
    expect(step?.when).toBe("4 weeks before");
    const decor = plan.budget.find((l) => l.category === "Decor");
    const spare = plan.budget.find((l) => l.category === "Contingency");
    expect(decor?.amount).toBe(13500);
    expect(spare?.amount).toBe(500);
    const total = (b: typeof plan.budget) => b.reduce((a, l) => a + l.amount, 0);
    expect(total(plan.budget)).toBe(total(samplePlan.budget));
    expect(lines.join(" ")).toContain("taken from Contingency");
  });

  it("prefers the most fitting budget line", () => {
    const plan = {
      ...samplePlan,
      budget: [{ category: "Venue & stay", amount: 30000, note: "" }, ...samplePlan.budget],
    };
    const { plan: next } = addIdeaToPlan(
      plan,
      baseInput,
      idea("Dress-up corner", { moment: "arrival", cost: 1000 }),
      today,
    );
    expect(next.budget.find((l) => l.category === "Decor")?.amount).toBe(13000);
    expect(next.budget.find((l) => l.category === "Venue & stay")?.amount).toBe(30000);
  });

  it("says plainly when there isn't enough spare money", () => {
    const { plan, lines } = addIdeaToPlan(
      samplePlan,
      baseInput,
      idea("Live pasta counter", { moment: "food", cost: 5000, effort: "easy" }),
      today,
    );
    expect(plan.budget.find((l) => l.category === "Food")?.amount).toBe(22000);
    expect(plan.budget.find((l) => l.category === "Contingency")?.amount).toBe(0);
    expect(lines.join(" ")).toMatch(/₹3,000 more is needed/);
    const step = plan.timeline.find((s) => s.tasks.some((t) => t.task.startsWith("Idea: Live pasta")));
    expect(step?.when).toBe("Event day");
  });

  it("adds it to the matching vendor's message once", () => {
    const tea = idea("Kulfi cart", { moment: "food", effort: "vendor" });
    const first = addIdeaToPlan(samplePlan, baseInput, tea, today);
    expect(first.plan.vendors[0].brief).toContain("We would also like: Kulfi cart.");
    const again = addIdeaToPlan(first.plan, baseInput, tea, today);
    expect(again.plan.vendors[0].brief.match(/Kulfi cart/g)).toHaveLength(1);
    expect(again.plan.timeline.flatMap((s) => s.tasks).filter((t) => t.task === "Idea: Kulfi cart")).toHaveLength(1);
  });

  it("says when no budget line matches, and names the function in the task", () => {
    const plan = { ...samplePlan, budget: samplePlan.budget.filter((l) => !/Return gifts|Decor/.test(l.category)) };
    const { plan: next, lines } = addIdeaToPlan(
      plan,
      baseInput,
      idea("Seed-paper favours", { moment: "send-off", cost: 900, forFunction: "Reception" }),
      today,
    );
    expect(lines.join(" ")).toMatch(/No budget line matched/);
    expect(next.timeline.flatMap((s) => s.tasks).some((t) => t.task === "Idea: Seed-paper favours (Reception)")).toBe(
      true,
    );
  });
});

describe("asking Claude for ideas", () => {
  it("puts the heart, traditions and food rules in the prompt, as data", () => {
    const prompt = buildIdeasPrompt(request({ leanings: ["eco"], forFunction: "Mehendi" }));
    expect(prompt).toContain("<user_details>");
    expect(prompt).toContain("Who it is really for: Aarav, our little explorer");
    expect(prompt).toContain("How guests should feel: Fun, Cosy");
    expect(prompt).toContain("The host's own idea or must-have: a mini zoo corner");
    expect(prompt).toContain("Food rule: Jain");
    expect(prompt).toContain("Tradition: Tamil");
    expect(prompt).toContain("Lean towards: Eco-friendly");
    expect(prompt).toContain('set forFunction to "Mehendi"');
    expect(prompt).toContain("Do not repeat these ideas already on the page: Leaf garlands");
  });

  it("asks for three directions that build on the host's idea", () => {
    expect(buildIdeasPrompt(request({ mode: "themes" }))).toMatch(/three clearly different theme directions/);
    expect(buildIdeasPrompt(request({ mode: "ideas", direction: direction as never }))).toContain("Garden of Lights");
    expect(buildIdeasPrompt(request({ seed: "Dhol at the entry" }))).toContain('"Dhol at the entry"');
  });

  it("returns valid theme directions only", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ directions: [direction, { ...direction, colors: [] }, { name: "x" }] }));
    const result = await suggestIdeas(request({ mode: "themes" }), generate);
    expect(result).toEqual({ mode: "themes", directions: [expect.objectContaining({ name: "Garden of Lights" })] });
  });

  it("returns ideas, tying them to the chosen function", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify({
        signature: direction.signature,
        items: [idea("Henna bar", { moment: "fun", forFunction: "Sangeet" }), { title: "" }],
      }),
    );
    const result = await suggestIdeas(request({ forFunction: "Mehendi" }), generate);
    expect(result.mode).toBe("more");
    if (result.mode === "themes") throw new Error("wrong mode");
    expect(result.signature).toBeNull();
    expect(result.items).toEqual([expect.objectContaining({ title: "Henna bar", forFunction: "Mehendi" })]);

    const full = await suggestIdeas(request({ mode: "ideas", direction: direction as never }), generate);
    if (full.mode === "themes") throw new Error("wrong mode");
    expect(full.signature?.title).toBe("Lantern release");
  });

  it("passes refusals through and reports other failures kindly", async () => {
    const refuse = vi.fn().mockRejectedValue(new PlannerError("Shubā can't help with that request.", 422));
    await expect(suggestIdeas(request(), refuse)).rejects.toMatchObject({ status: 422 });
    const empty = vi.fn().mockResolvedValue(JSON.stringify({ signature: null, items: [] }));
    await expect(suggestIdeas(request(), empty)).rejects.toMatchObject({ status: 502 });
    const broken = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(suggestIdeas(request(), broken)).rejects.toMatchObject({ status: 502 });
  });

  it("rejects unsafe text from the browser", () => {
    const bad = { ...request(), heart: { forWhom: "<img src=x>", feelings: [], own: "" } };
    // Unsafe heart text is cleared rather than sent on.
    expect(IdeasRequestSchema.parse(bad).heart.forWhom).toBe("");
    expect(IdeasRequestSchema.safeParse({ ...request(), seed: "{{evil}}" }).success).toBe(false);
    expect(IdeasRequestSchema.safeParse({ ...request(), mode: "everything" }).success).toBe(false);
  });
});
