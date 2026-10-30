import { describe, expect, it } from "vitest";
import { isScheduled, memberSummaries, teamTotals } from "@/components/team/teamSummary";
import { schedule } from "@/lib/schedule";
import { planItems } from "@/lib/team";
import { samplePlan } from "./fixtures";

const items = planItems(samplePlan);
const team = [
  { id: "mravi", name: "Ravi", role: "" },
  { id: "mmeena", name: "Meena", role: "aunt" },
];

describe("teamTotals", () => {
  it("counts done and unassigned items", () => {
    const totals = teamTotals(items, { [items[0].id]: "mravi" }, { [items[1].id]: true });
    expect(totals).toEqual({ total: items.length, done: 1, unassigned: items.length - 1 });
  });

  it("handles an empty plan", () => {
    expect(teamTotals([], {}, {})).toEqual({ total: 0, done: 0, unassigned: 0 });
  });
});

describe("memberSummaries", () => {
  const assignments = { [items[0].id]: "mravi", [items[1].id]: "mravi" };

  it("counts each member's tasks and leaves the message empty without a link", () => {
    const [ravi, meena] = memberSummaries({
      team,
      items,
      assignments,
      done: { [items[0].id]: true },
      eventTitle: "Party",
      shareUrl: null,
    });
    expect(ravi).toMatchObject({ total: 2, finished: 1, message: "" });
    expect(meena).toMatchObject({ total: 0, finished: 0, message: "" });
  });

  it("lists only pending tasks in the message once shared", () => {
    const [ravi] = memberSummaries({
      team,
      items,
      assignments,
      done: { [items[0].id]: true },
      eventTitle: "Party",
      shareUrl: "https://x.example/p/abc",
    });
    expect(ravi.message).toContain(items[1].label);
    expect(ravi.message).not.toContain(`• ${items[0].label}`);
    expect(ravi.message).toContain("https://x.example/p/abc");
  });

  it("adds due labels for scheduled items when today is known", () => {
    const { timeline } = schedule(samplePlan, "2026-12-12", "2026-10-24", {});
    const scheduled = timeline.flat();
    const [ravi] = memberSummaries({
      team,
      items: scheduled,
      assignments: { [scheduled[0].id]: "mravi" },
      done: {},
      eventTitle: "Party",
      shareUrl: "https://x.example/p/abc",
      today: "2026-10-24",
    });
    expect(ravi.message).toMatch(/\((Overdue|Due|By) /);
  });
});

describe("isScheduled", () => {
  it("tells scheduled items from plain plan items", () => {
    const { timeline } = schedule(samplePlan, "2026-12-12", "2026-10-24", {});
    expect(isScheduled(items[0])).toBe(false);
    expect(isScheduled(timeline.flat()[0])).toBe(true);
  });
});
