import { describe, expect, it } from "vitest";
import {
  MemberSchema,
  SHARE_ID,
  hash,
  makeSharedContentSchema,
  memberMessage,
  planItems,
  planStructure,
  pruneState,
  whatsappLink,
} from "@/lib/team";
import { newShareId } from "@/lib/store";
import { NOW, baseInput, samplePlan } from "./fixtures";

const ravi = { id: "mravi", name: "Ravi", role: "cousin" };
const meena = { id: "mmeena", name: "Meena", role: "" };

describe("plan items", () => {
  it("lists every task and one booking per vendor", () => {
    const items = planItems(samplePlan);
    expect(items).toHaveLength(3 + 2);
    expect(items.filter((i) => i.kind === "vendor").map((i) => i.label)).toEqual(["Book caterer", "Book entertainer"]);
  });

  it("gives the same ids for the same text, so ticks survive plan changes", () => {
    const changed = { ...samplePlan, summary: "Different summary", theme: { ...samplePlan.theme, name: "Other" } };
    expect(planItems(changed).map((i) => i.id)).toEqual(planItems(samplePlan).map((i) => i.id));
    expect(hash("abc")).toBe(hash("abc"));
  });

  it("keeps ids unique even for repeated tasks", () => {
    const repeated = {
      ...samplePlan,
      timeline: [
        {
          when: "Day",
          daysBefore: 1,
          tasks: [
            { task: "Call", priority: "low" as const, milestone: false },
            { task: "Call", priority: "low" as const, milestone: false },
          ],
        },
        ...samplePlan.timeline,
      ],
    };
    const ids = planItems(repeated).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("groups tasks by timeline step", () => {
    const { timeline, vendors } = planStructure(samplePlan);
    expect(timeline.map((t) => t.length)).toEqual([1, 1, 1]);
    expect(vendors).toHaveLength(2);
  });
});

describe("pruneState", () => {
  it("drops ticks and owners for removed tasks or people", () => {
    const [first, second] = planItems(samplePlan);
    const result = pruneState(
      samplePlan,
      [ravi],
      { [first.id]: "mravi", [second.id]: "mgone", t_zzz: "mravi" },
      { [first.id]: true, t_zzz: true },
    );
    expect(result.assignments).toEqual({ [first.id]: "mravi" });
    expect(result.done).toEqual({ [first.id]: true });
  });
});

describe("validation", () => {
  it("accepts names in any script and rejects markup", () => {
    expect(MemberSchema.safeParse({ id: "mabc", name: "रवि", role: "भाई" }).success).toBe(true);
    expect(MemberSchema.safeParse({ id: "mabc", name: "<b>Ravi</b>" }).success).toBe(false);
    expect(MemberSchema.safeParse({ id: "../etc", name: "Ravi" }).success).toBe(false);
  });

  it("accepts a shared plan whose date has passed (useful on the day)", () => {
    const schema = makeSharedContentSchema(NOW);
    const content = { input: { ...baseInput, date: "2026-10-20" }, plan: samplePlan, team: [ravi], assignments: {} };
    expect(schema.safeParse(content).success).toBe(true);
  });

  it("rejects unknown item ids in assignments", () => {
    const schema = makeSharedContentSchema(NOW);
    const content = { input: baseInput, plan: samplePlan, team: [ravi], assignments: { "<script>": "mravi" } };
    expect(schema.safeParse(content).success).toBe(false);
  });

  it("creates unguessable share ids", () => {
    const ids = new Set(Array.from({ length: 200 }, newShareId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(SHARE_ID.test(id)).toBe(true);
  });
});

describe("WhatsApp messages", () => {
  it("lists a person's tasks with the team link", () => {
    const items = planItems(samplePlan).slice(0, 2);
    const text = memberMessage(meena, items, "Aarav turns 5", "https://shuba.example/p/abc");
    expect(text).toContain("Hi Meena");
    expect(text).toContain("• Send invites (4 weeks before)");
    expect(text).toContain("https://shuba.example/p/abc");
    expect(whatsappLink(text)).toMatch(/^https:\/\/wa\.me\/\?text=Hi%20Meena/);
  });
});
