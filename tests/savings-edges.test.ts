import { describe, expect, it, vi } from "vitest";
import { buildSavingsPrompt, raiseBudgetOption, standardOptions, suggestSavings } from "@/lib/savings";
import type { SavingsRequest } from "@/lib/savings";
import { baseInput, samplePlan } from "./fixtures";

const request = (over: Partial<SavingsRequest> = {}): SavingsRequest => ({
  input: { ...baseInput },
  budget: samplePlan.budget,
  vendors: [],
  mode: "cut",
  need: 5000,
  overLines: [],
  ...over,
});

const option = (kind: string, instruction = "Spend less on something specific here.") => ({
  kind,
  title: "A choice",
  detail: "Some detail.",
  saving: 1000,
  affects: "Something changes.",
  instruction,
});

describe("raiseBudgetOption wording", () => {
  it("uses 'gets' when only one line is over budget", () => {
    const opt = raiseBudgetOption(50000, [{ category: "Food", over: 1200 }]);
    expect(opt?.detail).toContain("Food gets the extra money");
    expect(opt?.saving).toBe(2000);
  });

  it("offers nothing when no line is over", () => {
    expect(raiseBudgetOption(50000, [])).toBeNull();
  });
});

describe("standardOptions fallbacks", () => {
  it("names 'the over-booked lines' in cover mode when none were sent", () => {
    const [first] = standardOptions(request({ mode: "cover" }));
    expect(first.instruction).toContain("move the money saved to the over-booked lines");
  });

  it("offers no choices when every line is a priority or empty and the guest list is small", () => {
    const opts = standardOptions(
      request({
        input: { ...baseInput, guests: 10, focus: ["food"] },
        budget: [
          { category: "Catering", amount: 20000, note: "" },
          { category: "Decor", amount: 0, note: "" },
        ],
      }),
    );
    expect(opts).toEqual([]);
  });

  it("offers only the simpler-option choice when just one line can be cut", () => {
    const opts = standardOptions(request({ budget: [{ category: "Decor", amount: 8000, note: "" }] }));
    expect(opts.map((o) => o.kind)).toEqual(["cheaper-options"]);
    expect(opts[0].saving).toBe(2000);
  });

  it("caps each saving at the amount needed", () => {
    const opts = standardOptions(request({ need: 500 }));
    expect(opts.filter((o) => o.kind !== "fewer-guests").every((o) => o.saving <= 500)).toBe(true);
  });

  it("skips the fewer-guests choice for gatherings under 20 people", () => {
    const opts = standardOptions(request({ input: { ...baseInput, guests: 15 } }));
    expect(opts.some((o) => o.kind === "fewer-guests")).toBe(false);
  });
});

describe("buildSavingsPrompt optional lines", () => {
  it("leaves out the details the host did not give", () => {
    const prompt = buildSavingsPrompt(
      request({ input: { ...baseInput, eventName: "", style: "", notes: "" }, vendors: [], overLines: [] }),
    );
    for (const missing of [
      "Event name:",
      "Style:",
      "Host notes:",
      "Vendors:",
      "Bookings over budget:",
      "Food preference:",
    ]) {
      expect(prompt).not.toContain(missing);
    }
    expect(prompt).toContain("Need to spend ₹5,000 less in total.");
  });

  it("includes the food rule and guest needs when given", () => {
    const prompt = buildSavingsPrompt(request({ input: { ...baseInput, food: "jain", guestNeeds: ["elderly"] } }));
    expect(prompt).toContain("Food preference: jain");
    expect(prompt).toContain("Guest needs:");
  });
});

describe("suggestSavings when the AI gives too little", () => {
  it("falls back to standard choices when fewer than two usable choices remain", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify({
        options: [option("cheaper-options"), option("raise-budget"), option("family-help", "short")],
      }),
    );
    const result = await suggestSavings(request(), generate);
    expect(result.source).toBe("standard");
    expect(result.options.map((o) => o.kind)).toEqual(standardOptions(request()).map((o) => o.kind));
  });

  it("caps an AI saving at the total budget and rounds it to the nearest hundred", async () => {
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify({
        options: [
          { ...option("cheaper-options"), saving: 9_000_000 },
          { ...option("family-help"), saving: 1249 },
        ],
      }),
    );
    const result = await suggestSavings(request(), generate);
    expect(result.source).toBe("ai");
    expect(result.options.map((o) => o.saving)).toEqual([50000, 1200]);
  });

  it("does not add a raise-budget choice in cut mode", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("busy"));
    const result = await suggestSavings(request({ overLines: [{ category: "Food", over: 3000 }] }), generate);
    expect(result.options.some((o) => o.kind === "raise-budget")).toBe(false);
  });
});
