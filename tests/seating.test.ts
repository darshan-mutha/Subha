import { describe, expect, it } from "vitest";
import type { Reply } from "@/lib/rsvp";
import { DEFAULT_SEATING, planSeating, SeatingSchema, seatingText, tableLine } from "@/lib/seating";
import { makeSharedContentSchema } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

let n = 0;
const r = (name: string, adults: number, over: Partial<Reply> = {}): Reply => ({
  id: `r${String(++n).padStart(6, "0")}`,
  name,
  phone: "",
  coming: "yes",
  adults,
  kids: 0,
  food: "veg",
  needs: [],
  group: "",
  note: "",
  createdAt: "",
  updatedAt: "",
  ...over,
});

const names = (plan: ReturnType<typeof planSeating>) => plan.tables.map((t) => t.seats.map((s) => s.name));

describe("seating", () => {
  it("keeps families whole and fills tables biggest first", () => {
    const plan = planSeating([r("A", 5), r("B", 3), r("C", 4), r("D", 2)], DEFAULT_SEATING);
    expect(names(plan)).toEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(plan.people).toBe(14);
    expect(plan.tables.every((t) => t.people <= 8)).toBe(true);
  });

  it("seats each side together and merges small leftovers", () => {
    const plan = planSeating(
      [
        r("Bride1", 6, { group: "bride" }),
        r("Bride2", 2, { group: "bride" }),
        r("Groom1", 7, { group: "groom" }),
        r("Groom2", 3, { group: "groom" }),
        r("Work1", 2, { group: "work" }),
      ],
      DEFAULT_SEATING,
    );
    expect(names(plan)).toEqual([["Bride1", "Bride2"], ["Groom1"], ["Groom2", "Work1"]]);
    expect(tableLine(plan.tables[0])).toBe("Bride's side · Vegetarian 8");
  });

  it("puts elderly and wheelchair guests nearest the entrance", () => {
    const plan = planSeating([r("A", 8), r("B", 8), r("Nani", 3, { needs: ["elderly"] })], DEFAULT_SEATING);
    expect(plan.tables[0].seats[0].name).toBe("Nani");
    expect(plan.tables[0].nearEntrance).toBe(true);
    expect(plan.tables[1].nearEntrance).toBe(false);
  });

  it("spreads a very big family over tables side by side", () => {
    const plan = planSeating([r("Big", 15, { kids: 2 }), r("Small", 2)], DEFAULT_SEATING);
    expect(plan.tables.map((t) => t.seats.map((s) => `${s.name}:${s.people}:${s.part ?? ""}`))).toEqual([
      ["Big:6:1 of 3"],
      ["Big:6:2 of 3"],
      ["Big:5:3 of 3"],
      ["Small:2:"],
    ]);
  });

  it("leaves out 'no' replies and includes 'maybe' only when asked", () => {
    const replies = [r("Yes", 2), r("No", 0, { coming: "no" }), r("Maybe", 3, { coming: "maybe" })];
    expect(planSeating(replies, DEFAULT_SEATING).people).toBe(2);
    const withMaybe = planSeating(replies, { ...DEFAULT_SEATING, includeMaybe: true });
    expect(withMaybe.people).toBe(5);
    expect(withMaybe.tables[0].seats.find((s) => s.name === "Maybe")?.maybe).toBe(true);
  });

  it("applies the host's moves, flags a full table and ignores stale moves", () => {
    const a = r("A", 6);
    const b = r("B", 6);
    const c = r("C", 4);
    const plan = planSeating([a, b, c], { ...DEFAULT_SEATING, moves: { [c.id]: 1, r999999: 2 } });
    const first = plan.tables[0];
    expect(first.seats.map((s) => s.name)).toEqual(["A", "C"]);
    expect(first.over).toBe(2);
    expect(first.seats[1].moved).toBe(true);

    const toNew = planSeating([a, b], { ...DEFAULT_SEATING, moves: { [a.id]: 4 } });
    expect(toNew.tables.map((t) => t.seats.length)).toEqual([0, 1, 0, 1]);
    expect(toNew.tables[3].seats[0].name).toBe("A");
  });

  it("does not move a family spread over tables", () => {
    const big = r("Big", 12);
    const plan = planSeating([big], { ...DEFAULT_SEATING, moves: { [big.id]: 3 } });
    expect(plan.tables).toHaveLength(2);
  });

  it("uses the chosen table size and copies as text", () => {
    const plan = planSeating([r("A", 5), r("B", 5)], { ...DEFAULT_SEATING, tableSize: 10 });
    expect(plan.tables).toHaveLength(1);
    expect(seatingText("Aarav turns 5", planSeating([r("Nani", 2, { needs: ["wheelchair"] })]))).toBe(
      "Seating for Aarav turns 5\nTable 1 – near the entrance, step-free: Nani (2)",
    );
  });

  it("checks saved settings and keeps old plans working", () => {
    expect(SeatingSchema.parse({ tableSize: 7, includeMaybe: "x", moves: { bad: 1 } })).toEqual(DEFAULT_SEATING);
    expect(SeatingSchema.parse({ tableSize: "10" }).tableSize).toBe(10);
    const content = { input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {} };
    expect(makeSharedContentSchema().parse(content).seating).toEqual(DEFAULT_SEATING);
  });
});
