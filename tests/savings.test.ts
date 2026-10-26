import { describe, expect, it, vi } from "vitest";
import {
  applyRaise,
  buildSavingsPrompt,
  cleanInstruction,
  overLines,
  raiseBudgetOption,
  SavingsRequestSchema,
  standardOptions,
  suggestSavings,
  totalOver,
  withTail,
  type SavingsRequest,
} from "@/lib/savings";
import { LIMITS } from "@/lib/schemas";
import { baseInput, samplePlan } from "./fixtures";

const booked = new Map([
  ["Food", 26000],
  ["Decor", 12500],
  ["Entertainment", 4000],
]);

const request: SavingsRequest = {
  input: { ...baseInput, focus: ["food"] },
  budget: samplePlan.budget,
  vendors: ["Caterer", "Entertainer"],
  mode: "cover",
  need: 6500,
  overLines: [
    { category: "Food", over: 6000 },
    { category: "Decor", over: 500 },
  ],
};

const aiReply = {
  options: [
    {
      kind: "cheaper-options",
      title: "Home baker for the cake",
      detail: "Order the cake from a home baker instead of a bakery chain.",
      saving: 2500,
      affects: "Fewer cake designs to pick from.",
      instruction: "Order the cake from a home baker to save about ₹2,500 on food.",
    },
    {
      kind: "family-help",
      title: "Family makes the decor",
      detail: "Cousins put up balloons and paper decorations the evening before.",
      saving: 5000,
      affects: "More work for family the day before.",
      instruction: "Have family do the decor themselves to save about ₹5,000 on decor.",
    },
    {
      kind: "family-help",
      title: "Duplicate kind is dropped",
      detail: "x",
      saving: 1,
      affects: "x",
      instruction: "Do something else that is long enough.",
    },
    { kind: "raise-budget", title: "AI may not offer this", detail: "x", saving: 1, affects: "x", instruction: "x" },
  ],
};

describe("over-budget lines", () => {
  it("finds lines whose bookings cost more than planned, biggest first", () => {
    const over = overLines(samplePlan.budget, booked);
    expect(over).toEqual([
      { category: "Food", over: 6000 },
      { category: "Decor", over: 500 },
    ]);
    expect(totalOver(over)).toBe(6500);
    expect(overLines(samplePlan.budget, new Map())).toEqual([]);
  });
});

describe("raise the budget", () => {
  it("is offered only when bookings are over, rounded up to ₹1,000", () => {
    expect(raiseBudgetOption(50000, [])).toBeNull();
    const option = raiseBudgetOption(50000, request.overLines);
    expect(option).toMatchObject({ kind: "raise-budget", saving: 7000 });
    expect(option?.title).toContain("₹57,000");
  });

  it("adds exactly what each line is short and leaves the rest alone", () => {
    const result = applyRaise(baseInput, samplePlan.budget, request.overLines);
    expect(result.input.budget).toBe(57000);
    const amount = (c: string) => result.budget.find((l) => l.category === c)?.amount;
    expect(amount("Food")).toBe(20000 + 6000 + 500); // rounding goes to the biggest
    expect(amount("Decor")).toBe(12500);
    expect(amount("Entertainment")).toBe(10000);
    const sum = (lines: typeof samplePlan.budget) => lines.reduce((s, l) => s + l.amount, 0);
    expect(sum(result.budget) - sum(samplePlan.budget)).toBe(7000);
    expect(result.changes[0]).toContain("₹50,000 → ₹57,000");
  });
});

describe("change requests", () => {
  it("strips characters the change route would refuse and keeps the length limit", () => {
    expect(cleanInstruction("Save <b>₹5,000</b> {now}")).toBe("Save b₹5,000/b now");
    const long = withTail("x".repeat(400), "Keep the total budget the same.");
    expect(long.length).toBeLessThanOrEqual(LIMITS.maxInstruction);
    expect(long.endsWith("Keep the total budget the same.")).toBe(true);
  });
});

describe("request validation", () => {
  it("accepts a real request and rejects a tiny or missing amount", () => {
    expect(SavingsRequestSchema.safeParse(request).success).toBe(true);
    expect(SavingsRequestSchema.safeParse({ ...request, need: 10 }).success).toBe(false);
    expect(SavingsRequestSchema.safeParse({ ...request, mode: "spend" }).success).toBe(false);
  });
});

describe("prompt", () => {
  it("names priorities, over-booked lines and what is needed, inside user details", () => {
    const prompt = buildSavingsPrompt(request);
    expect(prompt).toMatch(/^<user_details>/);
    expect(prompt).toContain("Matters most (never cut): Food");
    expect(prompt).toContain("Food by ₹6,000");
    expect(prompt).toContain("keeping the total the same");
    expect(buildSavingsPrompt({ ...request, mode: "cut", overLines: [] })).toContain("₹6,500 less in total");
  });
});

describe("suggestSavings", () => {
  it("puts raise-budget first, keeps one choice per kind and adds where the money goes", async () => {
    const generate = vi.fn(async () => JSON.stringify(aiReply));
    const result = await suggestSavings(request, generate);
    expect(result.source).toBe("ai");
    expect(result.options.map((o) => o.kind)).toEqual(["raise-budget", "cheaper-options", "family-help"]);
    expect(result.options[1].instruction).toContain("move the money saved to Food, Decor");
  });

  it("lowers the total in cut mode and does not offer a bigger budget", async () => {
    const generate = vi.fn(async () => JSON.stringify(aiReply));
    const result = await suggestSavings({ ...request, mode: "cut", need: 10000, overLines: [] }, generate);
    expect(result.options[0].kind).toBe("cheaper-options");
    expect(result.options[0].instruction).toContain("Lower the total budget by ₹10,000 to ₹40,000");
  });

  it("falls back to standard choices that protect priorities when the AI is busy", async () => {
    const generate = vi.fn(async () => {
      throw new Error("down");
    });
    const result = await suggestSavings(request, generate);
    expect(result.source).toBe("standard");
    expect(result.options[0].kind).toBe("raise-budget");
    const text = result.options.map((o) => `${o.title} ${o.instruction}`).join(" ");
    expect(text).not.toMatch(/Spend about .* less on Food/);
    expect(result.options.some((o) => o.kind === "fewer-guests")).toBe(true);
  });

  it("does not hide a refusal", async () => {
    const { PlannerError } = await import("@/lib/ai");
    const generate = vi.fn(async () => {
      throw new PlannerError("no", 422);
    });
    await expect(suggestSavings(request, generate)).rejects.toMatchObject({ status: 422 });
  });

  it("standard choices never save more than needed", () => {
    for (const option of standardOptions({ ...request, need: 1000 })) {
      if (option.kind !== "fewer-guests") expect(option.saving).toBeLessThanOrEqual(1000);
    }
  });
});
