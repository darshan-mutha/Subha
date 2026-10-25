import { describe, expect, it } from "vitest";
import {
  MAX_MILESTONES,
  addDays,
  bloomMessage,
  milestoneItems,
  petalsFilled,
  daysBetween,
  doNext,
  dueText,
  normalizeTimeline,
  parseWhen,
  schedule,
  shortDate,
  statusOf,
} from "@/lib/schedule";
import { PlanSchema } from "@/lib/schemas";
import { planItems } from "@/lib/team";
import { samplePlan } from "./fixtures";

const TODAY = "2026-10-24";
const EVENT = "2026-12-12";

describe("dates", () => {
  it("adds and counts days across months", () => {
    expect(addDays("2026-12-12", -28)).toBe("2026-11-14");
    expect(daysBetween("2026-10-24", "2026-12-12")).toBe(49);
    expect(shortDate("2027-01-09")).toBe("9 Jan");
  });

  it.each([
    ["8 weeks before", 56],
    ["2 months before", 60],
    ["10 days before", 10],
    ["3-4 weeks before", 21],
    ["Day before", 1],
    ["Event day", 0],
    ["On the day", 0],
    ["Soon", null],
  ])("reads %s", (label, days) => {
    expect(parseWhen(label)).toBe(days);
  });
});

describe("normalizeTimeline", () => {
  it("never schedules work before today and keeps steps in order", () => {
    const plan = {
      ...samplePlan,
      timeline: [
        { when: "Event day", daysBefore: 0, tasks: [{ task: "Enjoy", priority: "low" as const, milestone: false }] },
        {
          when: "6 months before",
          daysBefore: null,
          tasks: [{ task: "Book venue", priority: "high" as const, milestone: false }],
        },
      ],
    };
    const result = normalizeTimeline(plan, "2026-11-01", TODAY);
    expect(result.timeline.map((s) => s.daysBefore)).toEqual([8, 0]);
    expect(result.vendors.map((v) => v.bookByDaysBefore)).toEqual([8, 8]);
  });

  it("places unreadable labels between their neighbours", () => {
    const plan = {
      ...samplePlan,
      timeline: [
        { when: "Start", daysBefore: null, tasks: [{ task: "A", priority: "low" as const, milestone: false }] },
        { when: "Middle", daysBefore: null, tasks: [{ task: "B", priority: "low" as const, milestone: false }] },
        { when: "End", daysBefore: null, tasks: [{ task: "C", priority: "low" as const, milestone: false }] },
      ],
    };
    const days = normalizeTimeline(plan, EVENT, TODAY).timeline.map((s) => s.daysBefore);
    expect(days).toEqual([49, 25, 0]);
  });
});

describe("status and due text", () => {
  it.each([
    ["2026-10-20", false, "overdue"],
    ["2026-10-28", false, "due-soon"],
    ["2026-11-20", false, "upcoming"],
    ["2026-10-20", true, "done"],
  ] as const)("%s done=%s is %s", (due, done, status) => {
    expect(statusOf(due, TODAY, done)).toBe(status);
  });

  it("speaks plainly", () => {
    expect(dueText({ due: "2026-10-20", status: "overdue" }, TODAY)).toBe("Overdue · was due 20 Oct");
    expect(dueText({ due: TODAY, status: "due-soon" }, TODAY)).toBe("Due today");
    expect(dueText({ due: "2026-10-25", status: "due-soon" }, TODAY)).toBe("Due tomorrow");
    expect(dueText({ due: "2026-11-14", status: "upcoming" }, TODAY)).toBe("By 14 Nov");
    expect(dueText({ due: "2026-11-14", status: "done" }, TODAY)).toBe("Done");
  });
});

describe("schedule and doNext", () => {
  it("gives each task its step's date and priority; vendors by must-have", () => {
    const { timeline, vendors, stepDue } = schedule(samplePlan, EVENT, TODAY, {});
    expect(stepDue).toEqual(["2026-11-14", "2026-12-05", "2026-12-12"]);
    expect(timeline[0][0]).toMatchObject({ label: "Send invites", priority: "high", due: "2026-11-14" });
    expect(vendors[0]).toMatchObject({ label: "Book caterer", priority: "high", due: "2026-11-12" });
    expect(vendors[1]).toMatchObject({ priority: "low", due: "2026-11-12" });
  });

  const allItems = (today: string, done = {}) => {
    const { timeline, vendors } = schedule(samplePlan, EVENT, today, done);
    return [...timeline.flat(), ...vendors];
  };

  it("puts overdue first, then earliest, then highest priority, skipping done", () => {
    const next = doNext(allItems("2026-11-20"), {}, "", 3);
    expect(next.every((i) => i.status === "overdue")).toBe(true);
    expect(next.map((i) => i.priority)).toEqual(["high", "low", "high"]);
    expect(next.map((i) => i.due)).toEqual(["2026-11-12", "2026-11-12", "2026-11-14"]);

    const [invites] = planItems(samplePlan);
    const afterTick = doNext(allItems("2026-11-20", { [invites.id]: true }), {});
    expect(afterTick.find((i) => i.id === invites.id)).toBeUndefined();
  });

  it("filters to one person", () => {
    const { timeline, vendors } = schedule(samplePlan, EVENT, TODAY, {});
    const items = [...timeline.flat(), ...vendors];
    const mine = doNext(items, { [items[1].id]: "mravi" }, "mravi");
    expect(mine.map((i) => i.id)).toEqual([items[1].id]);
  });
});

describe("older saved plans", () => {
  it("still load when tasks were plain text", () => {
    const old = {
      ...samplePlan,
      timeline: [{ when: "2 weeks before", tasks: ["Send invites"] }, ...samplePlan.timeline.slice(1)],
      vendors: samplePlan.vendors.map(({ bookByDaysBefore: _b, ...v }) => v),
    };
    const parsed = PlanSchema.parse(old);
    expect(parsed.timeline[0]).toEqual({
      when: "2 weeks before",
      daysBefore: null,
      tasks: [{ task: "Send invites", priority: "medium", milestone: false }],
    });
    expect(parsed.vendors[0].bookByDaysBefore).toBeNull();
  });

  it("treats an unknown priority as medium", () => {
    const odd = {
      ...samplePlan,
      timeline: [{ when: "Now", daysBefore: 3, tasks: [{ task: "X", priority: "urgent" }] }, ...samplePlan.timeline],
    };
    expect(PlanSchema.parse(odd).timeline[0].tasks[0].priority).toBe("medium");
  });
});

describe("milestones", () => {
  const all = () => {
    const { timeline, vendors } = schedule(samplePlan, EVENT, TODAY, {});
    return [...timeline.flat(), ...vendors];
  };

  it("uses flagged tasks and must-have bookings, in date order", () => {
    const list = milestoneItems(all());
    expect(list.map((m) => m.label)).toEqual(["Book caterer", "Send invites"]);
  });

  it("falls back to high-priority tasks when nothing is flagged", () => {
    const none = all().map((i) => ({ ...i, milestone: false }));
    expect(milestoneItems(none).map((m) => m.label)).toEqual(["Book caterer", "Send invites"]);
  });

  it("caps at five, one per colour petal", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...all()[0], id: `t_${i}`, milestone: true }));
    expect(milestoneItems(many)).toHaveLength(MAX_MILESTONES);
  });

  it("fills petals in proportion and fully at 100%", () => {
    const list = milestoneItems(all());
    expect(petalsFilled(list, 0.1)).toBe(0);
    expect(petalsFilled([{ ...list[0], status: "done" }, list[1]], 0.4)).toBe(3);
    expect(petalsFilled(list, 1)).toBe(5);
    expect(petalsFilled([], 0.5)).toBe(2);
  });

  it("writes a short, warm line", () => {
    expect(bloomMessage({ label: "Book the caterer" }, 0)).toBe("Caterer booked. The rest gets easier.");
    expect(bloomMessage({ label: "Send invitations" }, 1)).toBe("Send invitations: done. One big step closer.");
  });
});
