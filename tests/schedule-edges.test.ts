import { describe, expect, it } from "vitest";
import { addDays, delayItem, delayLines, normalizeTimeline, schedule } from "@/lib/schedule";
import type { DelayResult, ScheduledItem } from "@/lib/schedule";
import type { Plan } from "@/lib/schemas";
import { samplePlan } from "./fixtures";

const EVENT = "2026-12-12";
const TODAY = "2026-10-26";

const item = (id: string, due: string, over: Partial<ScheduledItem> = {}): ScheduledItem => ({
  id,
  kind: "task",
  label: `Task ${id}`,
  group: "g",
  priority: "medium",
  due,
  status: "upcoming",
  milestone: false,
  shifted: 0,
  ...over,
});

const moved = (id: string) => ({ id, label: `Task ${id}`, from: "2026-11-01", to: "2026-11-08" });

describe("schedule with missing day counts", () => {
  it("books must-have vendors 60 days out and others 30 days out by default", () => {
    const plan = { ...samplePlan, vendors: samplePlan.vendors.map((v) => ({ ...v, bookByDaysBefore: null })) };
    const { vendors } = schedule(plan, EVENT, TODAY, {});
    expect(vendors.map((v) => v.due)).toEqual([addDays(EVENT, -60), addDays(EVENT, -30)]);
    expect(vendors.map((v) => v.priority)).toEqual(["high", "low"]);
  });

  it("reads the step's label when it has no day count, and uses the event day when the label is unclear", () => {
    const plan = {
      ...samplePlan,
      timeline: [
        { when: "2 weeks before", daysBefore: null, tasks: [{ task: "A", priority: "high", milestone: false }] },
        { when: "Whenever suits", daysBefore: null, tasks: [{ task: "B", priority: "low", milestone: false }] },
      ],
    } as unknown as Plan;
    const { stepDue } = schedule(plan, EVENT, TODAY, {});
    expect(stepDue).toEqual([addDays(EVENT, -14), EVENT]);
  });

  it("normalizes vendors with no book-by date to the default, kept within the days left", () => {
    const plan = { ...samplePlan, vendors: samplePlan.vendors.map((v) => ({ ...v, bookByDaysBefore: null })) };
    const out = normalizeTimeline(plan, EVENT, "2026-12-01");
    expect(out.vendors.map((v) => v.bookByDaysBefore)).toEqual([11, 11]);
  });
});

describe("schedule shifts", () => {
  it("never moves an item that is already on or after the event day", () => {
    const [eventDayTask] = schedule(samplePlan, EVENT, TODAY, {}).timeline[2];
    const { timeline } = schedule(samplePlan, EVENT, TODAY, {}, { [eventDayTask.id]: 5 });
    expect(timeline[2][0]).toMatchObject({ due: EVENT, shifted: 0 });
  });

  it("stops a shift at the day before the event", () => {
    const [weekTask] = schedule(samplePlan, EVENT, TODAY, {}).timeline[1];
    const { timeline } = schedule(samplePlan, EVENT, TODAY, {}, { [weekTask.id]: 30 });
    expect(timeline[1][0]).toMatchObject({ due: "2026-12-11", shifted: 6 });
  });

  it("ignores negative shifts", () => {
    const [weekTask] = schedule(samplePlan, EVENT, TODAY, {}).timeline[1];
    const { timeline } = schedule(samplePlan, EVENT, TODAY, {}, { [weekTask.id]: -4 });
    expect(timeline[1][0]).toMatchObject({ due: "2026-12-05", shifted: 0 });
  });
});

describe("delayItem refusals", () => {
  const items = [item("a", "2026-11-01"), item("b", "2026-11-10")];

  it("returns null for an unknown item, zero days, or an item already done", () => {
    expect(delayItem(items, {}, "missing", 3, TODAY, EVENT)).toBeNull();
    expect(delayItem(items, {}, "a", 0, TODAY, EVENT)).toBeNull();
    expect(delayItem([item("a", "2026-11-01", { status: "done" })], {}, "a", 3, TODAY, EVENT)).toBeNull();
  });

  it("caps an overdue task's new date at the day before the event and flags it as squeezed", () => {
    // Due 9 Dec, today is 11 Dec: a week from today would pass the event, so it stops at 11 Dec.
    const result = delayItem([item("a", "2026-12-09")], {}, "a", 7, "2026-12-11", EVENT);
    expect(result?.target.to).toBe("2026-12-11");
    expect(result?.squeezed).toEqual(["Task a"]);
  });

  it("leaves a follower already on the day before the event where it is", () => {
    const list = [item("a", "2026-12-01"), item("b", "2026-12-11")];
    const result = delayItem(list, {}, "a", 3, TODAY, EVENT);
    expect(result?.later).toEqual([]);
    expect(result?.shifts.b).toBeUndefined();
  });

  it("skips done items and items on the event day when moving followers", () => {
    const list = [item("a", "2026-11-01"), item("b", "2026-11-05", { status: "done" }), item("c", EVENT)];
    const result = delayItem(list, {}, "a", 7, TODAY, EVENT);
    expect(result?.later).toEqual([]);
  });
});

describe("delayLines wording", () => {
  const base = (over: Partial<DelayResult>): DelayResult => ({
    shifts: {},
    target: moved("a"),
    later: [],
    squeezed: [],
    ...over,
  });

  it("uses the singular when one later task moved", () => {
    const lines = delayLines(base({ later: [moved("b")] }));
    expect(lines[1]).toMatch(/^1 later task moved with it, as it depends on it: Task b \(now /);
  });

  it("lists four followers and counts the rest", () => {
    const lines = delayLines(base({ later: ["b", "c", "d", "e", "f", "g"].map(moved) }));
    expect(lines[1]).toMatch(/^6 later tasks moved with it, as they depend on it: /);
    expect(lines[1]).toContain(", and 2 more.");
  });

  it("says when one task is squeezed, and trims a long squeezed list", () => {
    expect(delayLines(base({ squeezed: ["X"] }))[2]).toMatch(/^1 task is now due the day before the event.*: X\.$/);
    const many = delayLines(base({ squeezed: ["W", "X", "Y", "Z"] }))[2];
    expect(many).toMatch(/^4 tasks are now due/);
    expect(many).toContain("W, X, Y….");
  });
});
