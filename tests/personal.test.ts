import { describe, expect, it, vi } from "vitest";
import { rebalance } from "@/lib/budget";
import { cleanExtraction, type RawExtraction } from "@/lib/extract";
import { factChanges, refinePlan } from "@/lib/planner";
import { buildPlanPrompt, buildRefineFactsPrompt, buildRefinePrompt, SYSTEM_INSTRUCTION } from "@/lib/prompt";
import { makeEventInputSchema, RefineReplySchema } from "@/lib/schemas";
import { NOW, baseInput, samplePlan } from "./fixtures";

const schema = makeEventInputSchema(NOW);
const generator = (reply: object) => vi.fn().mockResolvedValue(JSON.stringify(reply));
const locate = vi
  .fn()
  .mockResolvedValue({ name: "Bengaluru", latitude: 12.9716, longitude: 77.5946, timeZone: "Asia/Kolkata" });

describe("personal choices in the event input", () => {
  it("defaults to no choices, so older saved plans still load", () => {
    const { focus, food, guestNeeds, ...old } = baseInput;
    void focus;
    void food;
    void guestNeeds;
    const parsed = schema.parse(old);
    expect(parsed.focus).toEqual([]);
    expect(parsed.food).toBe("");
    expect(parsed.guestNeeds).toEqual([]);
  });

  it("keeps known choices, drops unknown ones and duplicates", () => {
    const parsed = schema.parse({
      ...baseInput,
      focus: ["food", "food", "fireworks", "photos"],
      food: "pizza",
      guestNeeds: ["wheelchair", "hacker", "elderly"],
    });
    expect(parsed.focus).toEqual(["food", "photos"]);
    expect(parsed.food).toBe("");
    expect(parsed.guestNeeds).toEqual(["wheelchair", "elderly"]);
  });

  it("allows at most three priorities", () => {
    const result = schema.safeParse({ ...baseInput, focus: ["food", "decor", "photos", "venue"] });
    expect(result.success).toBe(false);
  });
});

describe("prompts", () => {
  it("tells the AI what matters most, the food and the guest needs", () => {
    const prompt = buildPlanPrompt(
      { ...baseInput, focus: ["food", "photos"], food: "jain", guestNeeds: ["wheelchair", "elderly"] },
      "2026-10-24",
    );
    expect(prompt).toContain("What matters most (in order; protect these when cutting costs): Food, Photos & video");
    expect(prompt).toContain("Food preference: Jain");
    expect(prompt).toContain("Guest needs: Wheelchair or step-free access, Elderly guests");
  });

  it("leaves the lines out when nothing was chosen", () => {
    const prompt = buildPlanPrompt(baseInput, "2026-10-24");
    expect(prompt).not.toContain("What matters most");
    expect(prompt).not.toContain("Guest needs");
  });

  it("has rules for estimates, dependencies, priorities and access", () => {
    expect(SYSTEM_INSTRUCTION).toContain("planning estimates");
    expect(SYSTEM_INSTRUCTION).toContain("dependencies come first");
    expect(SYSTEM_INSTRUCTION).toContain("cut the areas that matter least first");
    expect(SYSTEM_INSTRUCTION).toContain("accessible toilet");
  });

  it("asks change requests to handle a new date and explain the changes", () => {
    const facts = buildRefineFactsPrompt(baseInput, "Move it 2 weeks earlier", "2026-10-24");
    expect(facts).toContain("newDate");
    const prompt = buildRefinePrompt(baseInput, samplePlan, "Move it 2 weeks earlier", "2026-10-24", "core", [
      "Date moved from 12 Dec to 28 Nov",
    ]);
    expect(prompt).toContain('"changes"');
    expect(prompt).toContain("already settled; use them exactly: Date moved from 12 Dec to 28 Nov");
  });
});

describe("refinePlan with mid-stream changes", () => {
  const reply = (over: object) => ({
    ...samplePlan,
    newTotalBudget: 0,
    newGuestCount: 0,
    newDate: "",
    changes: [],
    ...over,
  });

  it("moves the date, guests and budget together and says what changed", async () => {
    const result = await refinePlan(
      baseInput,
      samplePlan,
      "We added 50 guests, budget is 10% lower and the date moved 2 weeks earlier",
      {
        generate: generator(
          reply({
            newTotalBudget: 45000,
            newGuestCount: 90,
            newDate: "2026-11-28",
            changes: ["Cut decor to protect food"],
          }),
        ),
        locate,
        now: NOW,
      },
    );
    expect(result.input.date).toBe("2026-11-28");
    expect(result.input.guests).toBe(90);
    expect(result.input.budget).toBe(45000);
    expect(result.changes).toEqual([
      "Date moved from 12 Dec to 28 Nov",
      "Guests: 40 → 90",
      "Total budget: ₹50,000 → ₹45,000",
      "Cut decor to protect food",
    ]);
  });

  it("ignores a new date that is in the past or not real", async () => {
    for (const newDate of ["2026-01-01", "2026-02-30", "soon"]) {
      const result = await refinePlan(baseInput, samplePlan, "Move it", {
        generate: generator(reply({ newDate })),
        locate,
        now: NOW,
      });
      expect(result.input.date).toBe(baseInput.date);
    }
  });

  it("works out auspicious timings again for a new date", async () => {
    const input = { ...baseInput, includeMuhurat: true };
    const result = await refinePlan(input, samplePlan, "One week later", {
      generate: generator(reply({ newDate: "2026-12-19" })),
      locate,
      now: NOW,
    });
    expect(result.timings?.date).toContain("19");
  });

  it("tolerates odd change notes from the AI", () => {
    const parsed = RefineReplySchema.parse({ ...samplePlan, changes: "not a list" });
    expect(parsed.changes).toEqual([]);
    expect(parsed.newDate).toBe("");
  });

  it("states nothing when nothing factual changed", () => {
    expect(factChanges(baseInput, baseInput)).toEqual([]);
  });
});

describe("voice picks up personal choices", () => {
  const raw: RawExtraction = {
    transcript: "Naani uses a wheelchair, food matters most, Jain food",
    eventType: "birthday",
    eventName: "",
    date: "2026-12-12",
    city: "Bengaluru",
    guests: 40,
    budget: 50000,
    style: "",
    notes: "",
    focus: ["food", "made-up"],
    food: "jain",
    guestNeeds: ["wheelchair", "elderly", "nonsense"],
  };

  it("keeps only valid choices", () => {
    const { values } = cleanExtraction(raw, NOW);
    expect(values.focus).toEqual(["food"]);
    expect(values.food).toBe("jain");
    expect(values.guestNeeds).toEqual(["wheelchair", "elderly"]);
  });

  it("drops an unknown food preference", () => {
    const { values } = cleanExtraction({ ...raw, food: "keto" }, NOW);
    expect(values.food).toBe("");
  });
});

describe("rebalance", () => {
  const lines = samplePlan.budget; // 20000, 12000, 10000, 5000, 2000 = 49000
  const total = 49000;
  const sum = (l: typeof lines) => l.reduce((s, x) => s + x.amount, 0);

  it("keeps the total when one line goes up", () => {
    const next = rebalance(lines, 2, 15000, total);
    expect(next[2].amount).toBe(15000);
    expect(sum(next)).toBe(total);
    expect(next[0].amount).toBeLessThan(20000);
  });

  it("gives the difference back to the others when a line goes down", () => {
    const next = rebalance(lines, 0, 10000, total);
    expect(next[0].amount).toBe(10000);
    expect(sum(next)).toBe(total);
    expect(next[1].amount).toBeGreaterThan(12000);
  });

  it("caps a line at the total and rounds to ₹100", () => {
    expect(rebalance(lines, 1, 999999, total)[1].amount).toBe(total);
    expect(rebalance(lines, 1, 12345, total)[1].amount).toBe(12300);
  });

  it("shares evenly when all other lines are zero", () => {
    const zero = lines.map((l, i) => ({ ...l, amount: i === 0 ? total : 0 }));
    const next = rebalance(zero, 0, total - 4000, total);
    expect(sum(next)).toBe(total);
    expect(next.slice(1).every((l) => l.amount === 1000)).toBe(true);
  });

  it("ignores bad input", () => {
    expect(rebalance(lines, 9, 100, total)).toBe(lines);
    expect(rebalance(lines, 0, Number.NaN, total)).toBe(lines);
    expect(rebalance([lines[0]], 0, 5, 7000)[0].amount).toBe(7000);
  });
});
