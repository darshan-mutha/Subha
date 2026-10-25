import { describe, expect, it } from "vitest";
import { formatINR, localWarnings, mergeWarnings, normalizeBudget } from "@/lib/budget";
import { NOW, baseInput, samplePlan } from "./fixtures";

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(1250000)).toBe("₹12,50,000");
  });
});

describe("normalizeBudget", () => {
  it("scales lines so they add up exactly to the total", () => {
    const lines = normalizeBudget(samplePlan.budget, 73_333);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(73_333);
  });

  it("sorts lines from largest to smallest", () => {
    const amounts = normalizeBudget(samplePlan.budget, 50_000).map((l) => l.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it("splits evenly when the AI returns all zero amounts", () => {
    const zeros = samplePlan.budget.map((l) => ({ ...l, amount: 0 }));
    const lines = normalizeBudget(zeros, 50_000);
    expect(lines.reduce((s, l) => s + l.amount, 0)).toBe(50_000);
    expect(lines.every((l) => l.amount >= 9_900)).toBe(true);
  });
});

describe("localWarnings", () => {
  it("is quiet for a realistic plan", () => {
    expect(localWarnings(baseInput, NOW)).toEqual([]);
  });

  it("flags a budget that is too low per guest", () => {
    const warnings = localWarnings({ ...baseInput, eventType: "wedding", guests: 300, budget: 20000 }, NOW);
    expect(warnings[0]).toMatch(/per guest/);
  });

  it("flags short notice", () => {
    const warnings = localWarnings({ ...baseInput, date: "2026-10-26" }, NOW);
    expect(warnings[0]).toMatch(/2 days to go/);
  });

  it("handles an event today", () => {
    expect(localWarnings({ ...baseInput, date: "2026-10-24" }, NOW)[0]).toMatch(/today/);
  });
});

describe("mergeWarnings", () => {
  it("removes duplicates and caps the list", () => {
    const merged = mergeWarnings(["Budget is tight."], ["budget is TIGHT!", "a", "b", "c", "d", "e", "f"]);
    expect(merged[0]).toBe("Budget is tight.");
    expect(merged.filter((w) => /tight/i.test(w))).toHaveLength(1);
    expect(merged.length).toBeLessThanOrEqual(6);
  });
});
