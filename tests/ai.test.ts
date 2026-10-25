import { describe, expect, it, vi } from "vitest";
import { PlannerError, extractJson, generateStructured } from "@/lib/ai";
import { PlanSchema } from "@/lib/schemas";
import { samplePlan } from "./fixtures";

describe("extractJson", () => {
  it("reads JSON wrapped in code fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("throws a friendly error for empty or broken replies", () => {
    expect(() => extractJson("")).toThrow(PlannerError);
    expect(() => extractJson('{"a": }')).toThrow(/incomplete/);
  });
});

const req = { system: "s", prompt: "p", jsonSchema: {} };

describe("generateStructured", () => {
  it("returns a validated plan", async () => {
    const generate = vi.fn().mockResolvedValue(JSON.stringify(samplePlan));
    await expect(generateStructured(req, PlanSchema, generate)).resolves.toEqual(samplePlan);
    expect(generate).toHaveBeenCalledWith(req);
  });

  it("retries once when the first reply is malformed", async () => {
    const generate = vi.fn().mockResolvedValueOnce("not json").mockResolvedValueOnce(JSON.stringify(samplePlan));
    await expect(generateStructured(req, PlanSchema, generate)).resolves.toEqual(samplePlan);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("gives up after two bad replies", async () => {
    const generate = vi.fn().mockResolvedValue(JSON.stringify({ summary: "only a summary" }));
    await expect(generateStructured(req, PlanSchema, generate)).rejects.toThrow(/wrong format/);
  });

  it("does not retry configuration errors", async () => {
    const generate = vi.fn().mockRejectedValue(new PlannerError("not configured", 503));
    await expect(generateStructured(req, PlanSchema, generate)).rejects.toMatchObject({ status: 503 });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("hides raw service errors from users", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("API key invalid: AIza..."));
    await expect(generateStructured(req, PlanSchema, generate)).rejects.toThrow(/busy/);
  });
});
