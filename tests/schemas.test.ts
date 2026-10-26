import { describe, expect, it } from "vitest";
import { PlanSchema, fieldErrors, makeEventInputSchema, makeRefineSchema, todayIST } from "@/lib/schemas";
import { NOW, baseInput, samplePlan } from "./fixtures";

const schema = makeEventInputSchema(NOW);

describe("event input validation", () => {
  it("accepts a valid event and coerces numbers from strings", () => {
    const result = schema.safeParse({ ...baseInput, guests: "40", budget: "50000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.guests).toBe(40);
      expect(result.data.budget).toBe(50000);
    }
  });

  it("rejects a date in the past", () => {
    const result = schema.safeParse({ ...baseInput, date: "2026-10-23" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).date).toMatch(/past/);
  });

  it("accepts today's date in India", () => {
    expect(schema.safeParse({ ...baseInput, date: "2026-10-24" }).success).toBe(true);
  });

  it("rejects impossible and far-future dates", () => {
    expect(schema.safeParse({ ...baseInput, date: "2027-02-30" }).success).toBe(false);
    expect(schema.safeParse({ ...baseInput, date: "2030-01-01" }).success).toBe(false);
  });

  it.each([
    ["guests", 0],
    ["guests", 10001],
    ["guests", 12.5],
    ["budget", 500],
    ["budget", -1],
  ])("rejects %s = %s", (field, value) => {
    expect(schema.safeParse({ ...baseInput, [field]: value }).success).toBe(false);
  });

  it("rejects markup and script injection in text fields", () => {
    const result = schema.safeParse({ ...baseInput, notes: "<script>alert(1)</script>" });
    expect(result.success).toBe(false);
    expect(schema.safeParse({ ...baseInput, city: "Pune; DROP TABLE" }).success).toBe(false);
  });

  it("accepts Indian-language text", () => {
    expect(schema.safeParse({ ...baseInput, city: "बेंगलुरु", notes: "शुद्ध शाकाहारी भोजन" }).success).toBe(true);
  });

  it("rejects an unknown event type with a friendly message", () => {
    const result = schema.safeParse({ ...baseInput, eventType: "rave" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).eventType).toBe("Please choose an event type");
  });

  it("gives today's date in IST even when UTC is still the previous day", () => {
    expect(todayIST(new Date("2026-10-23T20:00:00Z"))).toBe("2026-10-24");
  });
});

describe("plan and refine validation", () => {
  it("accepts a well-formed plan", () => {
    expect(PlanSchema.safeParse(samplePlan).success).toBe(true);
  });

  it("rejects a plan missing required sections", () => {
    const { vendors: _vendors, ...broken } = samplePlan;
    expect(PlanSchema.safeParse(broken).success).toBe(false);
  });

  it("requires a meaningful change request", () => {
    const refine = makeRefineSchema(NOW);
    expect(refine.safeParse({ input: baseInput, plan: samplePlan, instruction: "hi" }).success).toBe(false);
    expect(refine.safeParse({ input: baseInput, plan: samplePlan, instruction: "Make it eco-friendly" }).success).toBe(
      true,
    );
  });
});

describe("AI replies that run a little long", () => {
  it("trims long text at a word instead of rejecting the plan", async () => {
    const { clip, PlanSchema } = await import("@/lib/schemas");
    const { samplePlan } = await import("./fixtures");
    expect(clip("Short", 60)).toBe("Short");
    const long = "Accessibility support vendor for ramps, wheelchairs and an accessible toilet";
    const cut = clip(long, 60);
    expect(cut.length).toBeLessThanOrEqual(60);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/[ ,]…$/);

    const vendors = Array.from({ length: 12 }, (_, i) => ({ ...samplePlan.vendors[0], type: `${long} ${i}` }));
    const parsed = PlanSchema.parse({ ...samplePlan, vendors });
    expect(parsed.vendors).toHaveLength(10);
    expect(parsed.vendors[7].type.length).toBeLessThanOrEqual(60);
    expect(() => PlanSchema.parse({ ...samplePlan, vendors: [] })).toThrow();
  });
});
