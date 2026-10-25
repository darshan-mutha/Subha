import { describe, expect, it, vi } from "vitest";
import { assignTasks, balance, buildAssignPrompt } from "@/lib/assign";
import { planItems } from "@/lib/team";
import { samplePlan } from "./fixtures";

const team = [
  { id: "mravi", name: "Ravi", role: "cousin, knows caterers" },
  { id: "mmeena", name: "Meena", role: "sister" },
];

describe("balance", () => {
  it("keeps valid owners and spreads the rest evenly", () => {
    const result = balance(["a", "b", "c", "d"], team, { a: "mravi", b: "mghost" });
    expect(result.a).toBe("mravi");
    const counts = Object.values(result).reduce<Record<string, number>>(
      (acc, m) => ({ ...acc, [m]: (acc[m] ?? 0) + 1 }),
      {},
    );
    expect(counts).toEqual({ mravi: 2, mmeena: 2 });
  });
});

describe("assignTasks", () => {
  it("uses the AI's choices and fills any gaps", async () => {
    const ids = planItems(samplePlan).map((i) => i.id);
    const generate = vi.fn().mockResolvedValue(
      JSON.stringify({
        assignments: [
          { itemId: ids[0], memberId: "mmeena" },
          { itemId: "fake", memberId: "mravi" },
        ],
      }),
    );
    const result = await assignTasks("birthday", samplePlan, team, generate);
    expect(result[ids[0]]).toBe("mmeena");
    expect(Object.keys(result).sort()).toEqual([...ids].sort());
    expect(result.fake).toBeUndefined();
  });

  it("puts names in the data section of the prompt", () => {
    const prompt = buildAssignPrompt("birthday", samplePlan, team);
    expect(prompt).toMatch(/<user_details>[\s\S]*Ravi \(cousin, knows caterers\)[\s\S]*<\/user_details>/);
    expect(prompt).toContain("Book caterer");
  });
});
