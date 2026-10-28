import { describe, expect, it, vi } from "vitest";
import { createPlan, refinePlan } from "@/lib/planner";
import { NOW, baseInput, samplePlan } from "./fixtures";

const generator = (reply: object) => vi.fn().mockResolvedValue(JSON.stringify(reply));
const locate = vi
  .fn()
  .mockResolvedValue({ name: "Bengaluru", latitude: 12.9716, longitude: 77.5946, timeZone: "Asia/Kolkata" });

describe("createPlan", () => {
  it("makes the budget add up to the user's total, whatever the AI says", async () => {
    const odd = { ...samplePlan, budget: samplePlan.budget.map((b) => ({ ...b, amount: b.amount * 3 })) };
    const { plan } = await createPlan(baseInput, { generate: generator(odd), locate, now: NOW });
    expect(plan.budget.reduce((s, l) => s + l.amount, 0)).toBe(baseInput.budget);
  });

  it("adds Shubā's own warnings to the AI's", async () => {
    const input = { ...baseInput, guests: 400, budget: 20000 };
    const { plan } = await createPlan(input, { generate: generator(samplePlan), locate, now: NOW });
    expect(plan.warnings.some((w) => w.includes("per guest"))).toBe(true);
  });

  it("only calculates timings when asked", async () => {
    const without = await createPlan(baseInput, { generate: generator(samplePlan), locate, now: NOW });
    expect(without.timings).toBeNull();
    const withTimings = await createPlan(
      { ...baseInput, includeMuhurat: true },
      { generate: generator(samplePlan), locate, now: NOW },
    );
    expect(withTimings.timings?.rahuKalam.start).toMatch(/AM|PM/);
  });

  it("still returns a plan when the city cannot be located", async () => {
    const result = await createPlan(
      { ...baseInput, includeMuhurat: true },
      { generate: generator(samplePlan), locate: vi.fn().mockResolvedValue(null), now: NOW },
    );
    expect(result.plan.summary).toBeTruthy();
    expect(result.timings).toBeNull();
  });
});

describe("refinePlan", () => {
  it("applies a new budget from the change request", async () => {
    const reply = { ...samplePlan, newTotalBudget: 40000, newGuestCount: 0 };
    const result = await refinePlan(baseInput, samplePlan, "Reduce the budget by 20%", {
      generate: generator(reply),
      locate,
      now: NOW,
    });
    expect(result.input.budget).toBe(40000);
    expect(result.input.guests).toBe(baseInput.guests);
    expect(result.plan.budget.reduce((s, l) => s + l.amount, 0)).toBe(40000);
  });

  it("ignores impossible numbers from the AI", async () => {
    const reply = { ...samplePlan, newTotalBudget: 5, newGuestCount: 999999 };
    const result = await refinePlan(baseInput, samplePlan, "Make it huge", {
      generate: generator(reply),
      locate,
      now: NOW,
    });
    expect(result.input.budget).toBe(baseInput.budget);
    expect(result.input.guests).toBe(baseInput.guests);
  });
});

describe("refinePlan speed", () => {
  it("settles the facts first, then rewrites both halves at the same time", async () => {
    const { vendors, ideas, ...core } = samplePlan;
    const calls: string[] = [];
    const generate = vi.fn(async (request: { prompt: string; jsonSchema: object }) => {
      const keys = Object.keys((request.jsonSchema as { properties: object }).properties);
      if (keys.includes("newDate")) {
        calls.push("facts");
        return JSON.stringify({ newTotalBudget: 0, newGuestCount: 60, newDate: "" });
      }
      calls.push(keys.includes("vendors") ? "extras" : "core");
      expect(request.prompt).toContain("Guests: 40 → 60");
      return JSON.stringify(
        keys.includes("vendors")
          ? { vendors, ideas, changes: ["Briefs now say 60 guests"] }
          : { ...core, changes: ["More food, less decor"] },
      );
    });
    const result = await refinePlan(baseInput, samplePlan, "20 more guests", { generate, locate, now: NOW });
    expect(calls[0]).toBe("facts");
    expect(calls.slice(1).sort()).toEqual(["core", "extras"]);
    expect(result.input.guests).toBe(60);
    expect(result.plan.vendors.map((v) => v.type)).toEqual(vendors.map((v) => v.type));
    expect(result.changes).toEqual(["Guests: 40 → 60", "More food, less decor", "Briefs now say 60 guests"]);
  });
});

describe("createPlan speed", () => {
  it("writes the plan as two halves at the same time and joins them", async () => {
    const { vendors, ideas, ...core } = samplePlan;
    const generate = vi.fn(async (request: { prompt: string; jsonSchema: object }) => {
      const keys = Object.keys((request.jsonSchema as { properties: object }).properties);
      return JSON.stringify(keys.includes("vendors") ? { vendors, ideas } : core);
    });
    const { plan } = await createPlan(baseInput, { generate, locate: vi.fn(), now: NOW });
    expect(generate).toHaveBeenCalledTimes(2);
    const prompts = generate.mock.calls.map(([r]) => r.prompt);
    expect(prompts.some((p) => p.startsWith("Write only these parts of the plan: vendors and ideas"))).toBe(true);
    expect(prompts.some((p) => p.startsWith("Write only these parts of the plan: summary"))).toBe(true);
    expect(plan.vendors).toHaveLength(samplePlan.vendors.length);
    expect(plan.timeline.length).toBeGreaterThan(0);
    expect(plan.budget.reduce((s, l) => s + l.amount, 0)).toBe(baseInput.budget);
  });
});
