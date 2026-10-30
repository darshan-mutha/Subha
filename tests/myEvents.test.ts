// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPlan, type LocalWorkspace } from "@/lib/client";
import {
  currentEvent,
  listEvents,
  loadEvent,
  markShared,
  MAX_EVENTS,
  newEventKey,
  rememberShared,
  removeEvent,
  saveEvent,
  setCurrentEvent,
  sortEvents,
  titleOf,
  type EventEntry,
} from "@/lib/myEvents";
import { baseInput, samplePlan } from "./fixtures";

const ws = (over: Partial<LocalWorkspace["input"]> = {}): LocalWorkspace => ({
  input: { ...baseInput, ...over },
  plan: samplePlan,
  timings: null,
  team: [],
  assignments: {},
  done: {},
});
const SHARE = "A".repeat(22);

afterEach(() => localStorage.clear());

describe("My events storage", () => {
  it("makes valid, different keys", () => {
    const a = newEventKey();
    expect(a).toMatch(/^e[a-z0-9]{4,16}$/);
    expect(newEventKey()).not.toBe(a);
  });

  it("names an event by its name, or its type", () => {
    expect(titleOf(baseInput)).toBe("Aarav turns 5");
    expect(titleOf({ ...baseInput, eventName: "" })).toBe("Birthday");
  });

  it("saves several events and lists them", () => {
    saveEvent("eaaaa1", ws());
    saveEvent("ebbbb2", ws({ eventName: "Griha pravesh", eventType: "housewarming", date: "2026-11-20" }));
    const list = listEvents();
    expect(list.map((e) => e.title).sort()).toEqual(["Aarav turns 5", "Griha pravesh"]);
    expect(loadEvent("ebbbb2")?.input.eventName).toBe("Griha pravesh");
    // Saving again updates the same line, not a new one.
    saveEvent("eaaaa1", ws({ eventName: "Aarav turns 6" }));
    expect(listEvents()).toHaveLength(2);
    expect(listEvents().find((e) => e.key === "eaaaa1")?.title).toBe("Aarav turns 6");
  });

  it("refuses bad keys and ignores broken saved data", () => {
    expect(saveEvent("../x", ws())).toBe(false);
    expect(loadEvent("../x")).toBeNull();
    localStorage.setItem("shuba:events:v1", JSON.stringify([{ key: "bad" }, "x", null]));
    expect(listEvents()).toEqual([]);
    localStorage.setItem("shuba:events:v1", "{not json");
    expect(listEvents()).toEqual([]);
  });

  it("moves the plan from the one-plan version into the list, once", () => {
    localStorage.setItem("shuba:last-plan:v2", JSON.stringify(ws()));
    const list = listEvents();
    expect(list).toHaveLength(1);
    expect(loadPlan()).toBeNull();
    expect(currentEvent()).toBe(list[0].key);
    expect(loadEvent(list[0].key)?.input.eventName).toBe("Aarav turns 5");
    expect(listEvents()).toHaveLength(1);
  });

  it("keeps only the link once an event is shared", () => {
    saveEvent("eaaaa1", ws());
    markShared("eaaaa1", SHARE, baseInput);
    expect(loadEvent("eaaaa1")).toBeNull();
    expect(listEvents()).toMatchObject([{ key: "eaaaa1", sharedId: SHARE, title: "Aarav turns 5" }]);
  });

  it("remembers shared plans opened here, without duplicates", () => {
    rememberShared(SHARE, baseInput);
    rememberShared(SHARE, baseInput);
    expect(listEvents()).toHaveLength(1);
    rememberShared(SHARE, { ...baseInput, date: "2026-12-20" });
    expect(listEvents()).toMatchObject([{ sharedId: SHARE, date: "2026-12-20" }]);
    rememberShared("not-an-id", baseInput);
    expect(listEvents()).toHaveLength(1);
  });

  it("removes an event and forgets it as current", () => {
    saveEvent("eaaaa1", ws());
    setCurrentEvent("eaaaa1");
    removeEvent("eaaaa1");
    expect(listEvents()).toEqual([]);
    expect(loadEvent("eaaaa1")).toBeNull();
    expect(currentEvent()).toBe("");
  });

  it(`keeps at most ${MAX_EVENTS} events, dropping the least recently used`, () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < MAX_EVENTS + 2; i++) {
      vi.setSystemTime(1_800_000_000_000 + i * 1000);
      saveEvent(`e${String(i).padStart(5, "0")}`, ws());
    }
    vi.useRealTimers();
    const keys = listEvents().map((e) => e.key);
    expect(keys).toHaveLength(MAX_EVENTS);
    expect(loadEvent("e00000")).toBeNull();
  });

  it("sorts upcoming events soonest first, then past ones", () => {
    const e = (key: string, date: string): EventEntry => ({
      key,
      date,
      title: key,
      eventType: "birthday",
      city: "",
      updatedAt: 0,
    });
    const sorted = sortEvents(
      [e("epast1", "2026-01-01"), e("elate1", "2027-01-01"), e("esoon1", "2026-11-01")],
      "2026-10-26",
    );
    expect(sorted.map((x) => x.key)).toEqual(["esoon1", "elate1", "epast1"]);
  });
});
