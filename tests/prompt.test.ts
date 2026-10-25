import { describe, expect, it } from "vitest";
import {
  SYSTEM_INSTRUCTION,
  buildPlanPrompt,
  buildRefinePrompt,
  PLAN_JSON_SCHEMA,
  REFINE_JSON_SCHEMA,
} from "@/lib/prompt";
import { baseInput, samplePlan } from "./fixtures";

describe("prompts", () => {
  it("wraps host details in tags so they are treated as data", () => {
    const prompt = buildPlanPrompt(baseInput, "2026-10-24");
    expect(prompt).toMatch(/<user_details>[\s\S]*Bengaluru[\s\S]*<\/user_details>/);
    expect(prompt).toContain("₹50,000");
    expect(prompt).toContain("Today's date: 2026-10-24");
  });

  it("omits empty optional fields", () => {
    const prompt = buildPlanPrompt({ ...baseInput, notes: "", style: "" }, "2026-10-24");
    expect(prompt).not.toContain("Host notes");
    expect(prompt).not.toContain("Preferred style");
  });

  it("includes the current plan and change request when refining", () => {
    const prompt = buildRefinePrompt(baseInput, samplePlan, "Make it eco-friendly", "2026-10-24");
    expect(prompt).toContain("Change request: Make it eco-friendly");
    expect(prompt).toContain('"Jungle Safari"');
  });

  it("forbids invented muhurat and prompt injection in the system rules", () => {
    expect(SYSTEM_INSTRUCTION).toMatch(/Never state a muhurat/);
    expect(SYSTEM_INSTRUCTION).toMatch(/not instructions/);
  });

  it("refine schema extends the plan schema with new totals", () => {
    expect(REFINE_JSON_SCHEMA.required).toEqual(
      expect.arrayContaining([...PLAN_JSON_SCHEMA.required, "newTotalBudget"]),
    );
  });
});
