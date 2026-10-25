import { describe, expect, it } from "vitest";
import { cityFactor, formatShortINR, niceRound, perGuest, suggestBudgets, TIERS } from "@/lib/budgetGuide";
import { EVENT_TYPES } from "@/lib/schemas";

describe("suggestBudgets", () => {
  it("gives three rising levels for every event type", () => {
    for (const eventType of EVENT_TYPES) {
      for (const guests of [1, 40, 250, 10000]) {
        const options = suggestBudgets({ eventType, guests, city: "Mysuru" });
        expect(options.map((o) => o.tier)).toEqual([...TIERS]);
        for (const o of options) {
          expect(o.low).toBeGreaterThan(0);
          expect(o.high).toBeGreaterThanOrEqual(o.low);
          expect(o.suggested).toBeGreaterThanOrEqual(o.low);
          expect(o.suggested).toBeLessThanOrEqual(o.high);
          expect(o.includes).toHaveLength(4);
        }
        expect(options[1].suggested).toBeGreaterThan(options[0].suggested);
        expect(options[2].suggested).toBeGreaterThan(options[1].suggested);
      }
    }
  });

  it("matches a typical 250-guest Jaipur wedding", () => {
    const [simple, comfortable, grand] = suggestBudgets({ eventType: "wedding", guests: 250, city: "Jaipur" });
    expect(simple.low).toBe(470_000);
    expect(comfortable.suggested).toBeGreaterThan(1_000_000);
    expect(grand.high).toBe(3_750_000);
    expect(comfortable.perGuest).toBe(Math.round(comfortable.suggested / 250 / 10) * 10);
  });

  it("keeps a sensible minimum for very small events", () => {
    const [simple] = suggestBudgets({ eventType: "wedding", guests: 2 });
    expect(simple.low).toBe(50_000);
  });

  it("uses event-specific venues", () => {
    const [simple] = suggestBudgets({ eventType: "corporate-event", guests: 50 });
    expect(simple.includes[0]).toMatch(/Office/);
  });
});

describe("helpers", () => {
  it("prices big cities and destinations higher", () => {
    expect(cityFactor("  Bengaluru ")).toBe(1.15);
    expect(cityFactor("udaipur")).toBe(1.25);
    expect(cityFactor("Hubballi")).toBe(1);
  });

  it("rounds to everyday figures", () => {
    expect(niceRound(1234)).toBe(5_000);
    expect(niceRound(47_600)).toBe(50_000);
    expect(niceRound(321_000)).toBe(320_000);
    expect(niceRound(1_234_567)).toBe(1_250_000);
  });

  it("formats short rupee amounts", () => {
    expect(formatShortINR(45_000)).toBe("₹45,000");
    expect(formatShortINR(320_000)).toBe("₹3.2 lakh");
    expect(formatShortINR(12_500_000)).toBe("₹1.25 crore");
  });

  it("works out per-guest spend only when both numbers are real", () => {
    expect(perGuest(50_000, 40)).toBe(1250);
    expect(perGuest(NaN, 40)).toBeNull();
    expect(perGuest(50_000, 0)).toBeNull();
  });
});
