import { describe, expect, it } from "vitest";
import { canDelay, delayedDate, delayItem, delayLines, pruneShifts, shiftText } from "@/lib/delay";
import { schedule, type ScheduledItem } from "@/lib/schedule";
import { makeSharedContentSchema, planItems } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

const TODAY = "2026-10-24";
const EVENT = "2026-12-12";
// Sample plan dates: caterer 12 Nov, entertainer 12 Nov, invites 14 Nov, magician 5 Dec, decor on the day.

function all(shifts = {}, done = {}, today = TODAY): ScheduledItem[] {
  const s = schedule(samplePlan, EVENT, today, done, shifts);
  return [...s.timeline.flat(), ...s.vendors];
}
const byLabel = (items: ScheduledItem[], label: string) => items.find((i) => i.label === label)!;

describe("running late", () => {
  it("moves the late task and every unfinished task after it by the same days", () => {
    const items = all();
    const caterer = byLabel(items, "Book caterer");
    const result = delayItem(items, {}, caterer.id, 7, TODAY, EVENT)!;
    expect(result.target).toMatchObject({ from: "2026-11-12", to: "2026-11-19" });
    expect(result.later.map((m) => [m.label, m.to])).toEqual([
      ["Send invites", "2026-11-21"],
      ["Confirm magician", "2026-12-11"],
    ]);
    // Same-day booking and the event-day task stay put.
    const after = all(result.shifts);
    expect(byLabel(after, "Book entertainer").due).toBe("2026-11-12");
    expect(byLabel(after, "Set up decor by 2 PM").due).toBe(EVENT);
    expect(byLabel(after, "Book caterer")).toMatchObject({ due: "2026-11-19", shifted: 7 });
  });

  it("never moves anything onto the event day and reports the squeeze", () => {
    const items = all();
    const invites = byLabel(items, "Send invites");
    const result = delayItem(items, {}, invites.id, 14, TODAY, EVENT)!;
    const magician = result.later.find((m) => m.label === "Confirm magician")!;
    expect(magician.to).toBe("2026-12-11");
    expect(result.squeezed).toContain("Confirm magician");
    expect(delayLines(result).join(" ")).toMatch(/day before the event/);
  });

  it("leaves done tasks alone", () => {
    const items0 = all();
    const invites = byLabel(items0, "Send invites");
    const items = all({}, { [invites.id]: true });
    const result = delayItem(items, {}, byLabel(items, "Book caterer").id, 7, TODAY, EVENT)!;
    expect(result.later.map((m) => m.label)).toEqual(["Confirm magician"]);
  });

  it("moves an overdue task from today, and later tasks by the real gap", () => {
    const today = "2026-11-16"; // caterer was due 12 Nov
    const items = all({}, {}, today);
    const caterer = byLabel(items, "Book caterer");
    expect(caterer.status).toBe("overdue");
    expect(delayedDate(caterer, 3, today, EVENT)).toBe("2026-11-19");
    const result = delayItem(items, {}, caterer.id, 3, today, EVENT)!;
    // 12 → 19 Nov is 7 days, so invites move 7 days too.
    expect(result.later.find((m) => m.label === "Send invites")!.to).toBe("2026-11-21");
  });

  it("adds to earlier delays and can be undone by restoring the old shifts", () => {
    const first = delayItem(all(), {}, byLabel(all(), "Book caterer").id, 3, TODAY, EVENT)!;
    const items = all(first.shifts);
    const second = delayItem(items, first.shifts, byLabel(items, "Book caterer").id, 3, TODAY, EVENT)!;
    expect(byLabel(all(second.shifts), "Book caterer")).toMatchObject({ due: "2026-11-18", shifted: 6 });
    expect(byLabel(all(first.shifts), "Book caterer").due).toBe("2026-11-15");
  });

  it("refuses tasks that cannot move", () => {
    const items = all();
    const decor = byLabel(items, "Set up decor by 2 PM");
    expect(canDelay(decor, EVENT)).toBe(false);
    expect(delayItem(items, {}, decor.id, 3, TODAY, EVENT)).toBeNull();
    expect(delayItem(items, {}, "t_missing", 3, TODAY, EVENT)).toBeNull();
    expect(delayItem(items, {}, byLabel(items, "Book caterer").id, 0, TODAY, EVENT)).toBeNull();
    const dayBefore = { ...decor, due: "2026-12-11", status: "upcoming" as const };
    expect(canDelay(dayBefore, EVENT)).toBe(false);
  });

  it("writes plain lines for the What changed card", () => {
    const items = all();
    const result = delayItem(items, {}, byLabel(items, "Book caterer").id, 7, TODAY, EVENT)!;
    const lines = delayLines(result);
    expect(lines[0]).toBe("“Book caterer” moved to 19 Nov (was 12 Nov).");
    expect(lines[1]).toMatch(/^2 later tasks moved with it/);
    expect(lines.at(-1)).toBe("The event date stays the same.");
    const none = delayItem(items, {}, byLabel(items, "Confirm magician").id, 3, TODAY, EVENT)!;
    expect(delayLines(none)[1]).toBe("No later tasks needed to move.");
  });

  it("labels moved tasks and drops shifts for tasks no longer in the plan", () => {
    expect(shiftText(7)).toBe("Moved 1 week later");
    expect(shiftText(14)).toBe("Moved 2 weeks later");
    expect(shiftText(3)).toBe("Moved 3 days later");
    expect(shiftText(1)).toBe("Moved 1 day later");
    expect(shiftText(0)).toBe("");
    const ids = planItems(samplePlan).map((i) => i.id);
    expect(pruneShifts({ [ids[0]]: 3, t_gone: 4, [ids[1]]: 0 }, ids)).toEqual({ [ids[0]]: 3 });
    expect(pruneShifts(undefined, ids)).toEqual({});
  });

  it("is saved with shared plans, and bad values are dropped", () => {
    const schema = makeSharedContentSchema(new Date("2026-10-24T00:00:00Z"));
    const id = planItems(samplePlan)[0].id;
    const base = { input: baseInput, plan: samplePlan };
    expect(schema.parse({ ...base, shifts: { [id]: 7 } }).shifts).toEqual({ [id]: 7 });
    expect(schema.parse(base).shifts).toEqual({});
    expect(schema.parse({ ...base, shifts: { [id]: -5 } }).shifts).toEqual({});
  });
});
