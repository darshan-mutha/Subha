import { describe, expect, it } from "vitest";
import { suggestedFunctions } from "@/components/TraditionPicker";
import { normalizeFunctions } from "@/lib/planner";
import { buildPlanPartPrompt, traditionLines } from "@/lib/prompt";
import { PLAN_PARTS, planPartSchema } from "@/lib/promptSchemas";
import { makeEventInputSchema, PlanSchema, withInputDefaults, type EventInput } from "@/lib/schemas";
import { upgradeContent } from "@/lib/store";
import {
  dateOfDay,
  dayLabel,
  functionsToPlan,
  spreadOverDays,
  usualFunctions,
  type FunctionChoice,
} from "@/lib/traditions";
import { baseInput, NOW, samplePlan } from "./fixtures";

const wedding: EventInput = {
  ...baseInput,
  eventType: "wedding",
  eventName: "Meera & Kabir",
  guests: 300,
  budget: 2_000_000,
  traditions: ["punjabi", "tamil"],
  days: 3,
};

describe("usual functions", () => {
  it("suggests the usual functions for one tradition, in order", () => {
    expect(usualFunctions(["muslim"], "wedding")).toEqual(["Mangni", "Manjha (haldi)", "Mehendi", "Nikah", "Walima"]);
    expect(usualFunctions(["christian"], "wedding")).toContain("Church wedding");
  });

  it("joins two families' traditions: pre-wedding functions first, no repeats", () => {
    const list = usualFunctions(["punjabi", "tamil"], "wedding");
    expect(list.filter((f) => /mehendi/i.test(f))).toHaveLength(1);
    expect(list).toContain("Nalangu");
    expect(list.indexOf("Sangeet")).toBeLessThan(list.indexOf("Wedding (pheras)"));
    expect(list.indexOf("Nalangu")).toBeLessThan(list.indexOf("Muhurtham"));
    expect(list.at(-1)).toBe("Reception");
  });

  it("is only for weddings and falls back to a general list", () => {
    expect(usualFunctions(["tamil"], "birthday")).toEqual([]);
    expect(usualFunctions([], "wedding")).toContain("Sangeet");
  });
});

describe("spreading functions over days", () => {
  it("keeps the ceremony and reception on the last days", () => {
    const spread = spreadOverDays(["Haldi", "Mehendi", "Sangeet", "Wedding (pheras)", "Reception"], 3);
    const day = (n: string) => spread.find((f) => f.name === n)?.day;
    expect(day("Haldi")).toBe(1);
    expect(day("Wedding (pheras)")).toBeGreaterThanOrEqual(2);
    expect(day("Reception")).toBe(3);
    expect(spread.every((f) => f.day >= 1 && f.day <= 3)).toBe(true);
  });

  it("puts everything on day 1 for a one-day event", () => {
    expect(spreadOverDays(["Haldi", "Wedding"], 1).every((f) => f.day === 1)).toBe(true);
    expect(spreadOverDays([], 3)).toEqual([]);
  });

  it("adds modern additions as functions where they usually fall", () => {
    const list = suggestedFunctions(["north-hindu"], "wedding", 3, ["bachelor", "brunch", "choreography"]);
    expect(list[0]).toEqual({ name: "Bachelor / bachelorette party", day: 0 });
    expect(list.at(-1)).toEqual({ name: "Day-after brunch", day: 3 });
    expect(list.some((f) => /choreography/i.test(f.name))).toBe(false);
  });
});

describe("functions to plan", () => {
  it("uses the host's own choices, kept within the days", () => {
    const functions: FunctionChoice[] = [{ name: "Mayra", day: 5 }];
    expect(functionsToPlan({ ...wedding, functions })).toEqual([{ name: "Mayra", day: 3 }]);
  });

  it("fills in the usual set when a multi-day wedding has none", () => {
    expect(functionsToPlan(wedding).length).toBeGreaterThan(4);
    expect(functionsToPlan({ ...wedding, days: 1 })).toEqual([]);
    expect(functionsToPlan({ ...baseInput })).toEqual([]);
  });

  it("works out the dates and labels of days", () => {
    expect(dateOfDay("2027-02-27", 3)).toBe("2027-03-01");
    expect(dateOfDay("2027-02-27", 0)).toBeNull();
    expect(dayLabel(0)).toBe("Before the main days");
    expect(dayLabel(2)).toBe("Day 2");
  });
});

describe("event details with traditions", () => {
  const schema = makeEventInputSchema(NOW);
  const raw = {
    eventType: "wedding",
    date: "2027-02-12",
    city: "Chennai",
    guests: 300,
    budget: 2_000_000,
  };

  it("accepts traditions, days, functions and additions", () => {
    const parsed = schema.parse({
      ...raw,
      traditions: ["tamil", "punjabi", "made-up"],
      days: "3",
      functions: [{ name: "Nalangu", day: 1 }],
      additions: ["shoot", "fireworks"],
    });
    expect(parsed.traditions).toEqual(["tamil", "punjabi"]);
    expect(parsed.days).toBe(3);
    expect(parsed.functions).toEqual([{ name: "Nalangu", day: 1 }]);
    expect(parsed.additions).toEqual(["shoot"]);
  });

  it("defaults them for older plans and odd values", () => {
    const parsed = schema.parse({ ...raw, days: 40 });
    expect(parsed).toMatchObject({ traditions: [], days: 1, functions: [], additions: [], traditionOther: "" });
  });

  it("rejects unsafe function names and too many functions", () => {
    expect(schema.safeParse({ ...raw, functions: [{ name: "<script>", day: 1 }] }).success).toBe(false);
    const many = Array.from({ length: 13 }, (_, i) => ({ name: `Function ${i}`, day: 1 }));
    expect(schema.safeParse({ ...raw, functions: many }).success).toBe(false);
  });

  it("fills in missing fields on plans saved before traditions existed", () => {
    const old = { ...baseInput } as Partial<EventInput>;
    delete old.traditions;
    delete old.days;
    expect(withInputDefaults(old as EventInput)).toMatchObject({ traditions: [], days: 1, functions: [] });
  });
});

describe("prompt lines", () => {
  it("names both families, the days and every function", () => {
    const text = traditionLines({ ...wedding, additions: ["welcome"] }).join("\n");
    expect(text).toContain("Punjabi Hindu (the host's family) and Tamil (the other family)");
    expect(text).toContain("Number of days: 3");
    expect(text).toMatch(/Functions \(in order\): .*Reception - Day 3/);
    expect(text).toContain("Welcome dinner for outstation guests");
  });

  it("uses the host's own words for another tradition", () => {
    const text = traditionLines({ ...baseInput, traditions: ["other"], traditionOther: "Kodava" }).join("\n");
    expect(text).toBe("Tradition: Kodava");
    expect(traditionLines(baseInput)).toEqual([]);
  });

  it("both halves of a new plan see the same functions", () => {
    const core = buildPlanPartPrompt(wedding, "2026-10-26", "core");
    const extras = buildPlanPartPrompt(wedding, "2026-10-26", "extras");
    const line = (p: string) => p.split("\n").find((l) => l.startsWith("Functions"));
    expect(line(core)).toBeTruthy();
    expect(line(core)).toBe(line(extras));
    expect(PLAN_PARTS.core).toContain("functions");
    expect(Object.keys(planPartSchema("core").properties)).toContain("functions");
  });
});

describe("planned functions", () => {
  const fn = (name: string, day: number, amount: number, guests = 100) => ({
    name,
    day,
    time: "Evening",
    guests,
    amount,
    mood: "",
    rituals: [],
    needs: [],
  });

  it("scales costs to the total budget and keeps days and guests in range", () => {
    const out = normalizeFunctions([fn("Mehendi", 1, 100), fn("Wedding", 9, 300, 5000)], wedding);
    expect(out.reduce((a, f) => a + f.amount, 0)).toBe(wedding.budget);
    expect(out[1].day).toBe(3);
    expect(out[1].guests).toBe(300);
    expect(out[0].amount).toBe(500_000);
  });

  it("leaves empty lists and zero costs alone", () => {
    expect(normalizeFunctions([], wedding)).toEqual([]);
    expect(normalizeFunctions([fn("Haldi", 1, 0, 0)], wedding)[0]).toMatchObject({ amount: 0, guests: 300 });
  });

  it("reads plan functions leniently, dropping only broken ones", () => {
    const parsed = PlanSchema.parse({
      ...samplePlan,
      functions: [fn("Sangeet", 2, 1000), { name: "", day: 1 }, { ...fn("Haldi", 1, 10), day: "x", rituals: "no" }],
    });
    expect(parsed.functions.map((f) => f.name)).toEqual(["Sangeet", "Haldi"]);
    expect(parsed.functions[1]).toMatchObject({ day: 1, rituals: [] });
  });
});

describe("older shared plans", () => {
  it("are read into the new shape", () => {
    const old = {
      input: { ...baseInput, traditions: undefined },
      plan: { ...samplePlan, functions: undefined, ideas: { decor: ["Diyas"], food: [], activities: [], extras: [] } },
      timings: null,
      team: [],
      assignments: {},
    } as never;
    const content = upgradeContent(old);
    expect(content.input.traditions).toEqual([]);
    expect(content.plan.functions).toEqual([]);
    expect(content.plan.ideas.items[0]).toMatchObject({ title: "Diyas", moment: "welcome" });
  });
});
