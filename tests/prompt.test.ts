import { describe, expect, it } from "vitest";
import { SYSTEM_INSTRUCTION, buildPlanPrompt, buildRefinePrompt } from "@/lib/prompt";
import { PLAN_JSON_SCHEMA, REFINE_FACTS_JSON_SCHEMA, refinePartSchema } from "@/lib/promptSchemas";
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
    const core = buildRefinePrompt(baseInput, samplePlan, "Make it eco-friendly", "2026-10-24", "core");
    expect(core).toContain("Change request: Make it eco-friendly");
    expect(core).toContain('"Jungle Safari"');
    expect(core).not.toContain('"vendors"');
    const extras = buildRefinePrompt(baseInput, samplePlan, "Make it eco-friendly", "2026-10-24", "extras");
    expect(extras).toContain('"vendors"');
    expect(extras).not.toContain('"timeline"');
    expect(extras).toContain("Current budget lines");
  });

  it("forbids invented muhurat and prompt injection in the system rules", () => {
    expect(SYSTEM_INSTRUCTION).toMatch(/Never state a muhurat/);
    expect(SYSTEM_INSTRUCTION).toMatch(/not instructions/);
  });

  it("refine schema extends the plan schema with new totals", () => {
    expect(REFINE_FACTS_JSON_SCHEMA.required).toEqual(["newTotalBudget", "newGuestCount", "newDate"]);
    const both = [...refinePartSchema("core").required, ...refinePartSchema("extras").required];
    expect(both).toEqual(expect.arrayContaining([...PLAN_JSON_SCHEMA.required, "changes"]));
  });
});
