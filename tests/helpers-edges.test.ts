import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PlannerError } from "@/lib/ai";
import { balance, buildAssignPrompt } from "@/lib/assign";
import { buildGroupsPrompt, scaleGroups, standardGroups, suggestGuestGroups } from "@/lib/guestGroups";
import type { GuestGroupIdea } from "@/lib/guestGroups";
import { wrapText } from "@/lib/inviteCard";
import { normalizeFunctions, refinePlan } from "@/lib/planner";
import { combineLimiters, createRateLimiter } from "@/lib/rateLimit";
import { fieldErrors, withInputDefaults } from "@/lib/schemas";
import type { EventInput, Plan } from "@/lib/schemas";
import type { Member } from "@/lib/team";
import { baseInput, NOW, samplePlan } from "./fixtures";

const group = (name: string, about: number): GuestGroupIdea => ({ name, about, who: "People", side: "" });

describe("scaleGroups", () => {
  it("leaves the groups alone when their numbers add up to nothing or the total is zero", () => {
    const zero = [group("A", 0), group("B", 0)];
    expect(scaleGroups(zero, 100)).toBe(zero);
    const some = [group("A", 10)];
    expect(scaleGroups(some, 0)).toBe(some);
  });

  it("scales in steps of one for small gatherings, still adding up exactly", () => {
    const out = scaleGroups([group("A", 1), group("B", 1), group("C", 1)], 10);
    expect(out.reduce((s, g) => s + g.about, 0)).toBe(10);
    expect(out.map((g) => g.about)).toEqual([4, 3, 3]);
  });
});

describe("standardGroups by event type", () => {
  it("uses bride and groom sides for an engagement", () => {
    const { groups } = standardGroups({ ...baseInput, eventType: "engagement", guests: 200 });
    expect(groups.some((g) => g.side === "groom")).toBe(true);
  });

  it("uses the children's list for a naming ceremony and the general list for a housewarming", () => {
    expect(standardGroups({ ...baseInput, eventType: "naming-ceremony" }).groups[0].name).toBe("Child's friends");
    expect(standardGroups({ ...baseInput, eventType: "baby-shower" }).groups[0].name).toBe("Child's friends");
    expect(standardGroups({ ...baseInput, eventType: "housewarming" }).groups[0].name).toBe("Close family");
  });
});

describe("guest group prompt and fallback", () => {
  it("lists functions in the prompt only when there are some", () => {
    expect(buildGroupsPrompt({ input: baseInput, functions: [] })).not.toContain("Functions:");
    expect(buildGroupsPrompt({ input: baseInput, functions: ["Haldi", "Sangeet"] })).toContain(
      "Functions: Haldi, Sangeet",
    );
  });

  it("passes refusals through instead of falling back", async () => {
    const refuse = vi.fn().mockRejectedValue(new PlannerError("Not allowed", 422));
    await expect(suggestGuestGroups({ input: baseInput, functions: [] }, refuse)).rejects.toMatchObject({
      status: 422,
    });
  });

  it("falls back to standard groups for other AI errors", async () => {
    const busy = vi.fn().mockRejectedValue(new PlannerError("Busy", 503));
    const result = await suggestGuestGroups({ input: baseInput, functions: [] }, busy);
    expect(result.source).toBe("standard");
  });
});

describe("planner edge cases", () => {
  it("treats a missing day count as a one-day event when placing functions", () => {
    const input = { ...baseInput, days: undefined } as unknown as EventInput;
    const fns = [{ name: "Pooja", day: 3, mood: "", guests: 0, amount: 100, note: "" }] as unknown as Plan["functions"];
    const [fn] = normalizeFunctions(fns, input);
    expect(fn.day).toBe(1);
    expect(fn.guests).toBe(baseInput.guests);
    expect(fn.amount).toBe(baseInput.budget);
  });

  it("keeps the old date when the AI's new date is invalid", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ ...samplePlan, newTotalBudget: 0, newGuestCount: 0, newDate: "2001-01-01" }));
    const locate = vi.fn().mockResolvedValue(null);
    const result = await refinePlan(baseInput, samplePlan, "Move it", { generate, locate, now: NOW });
    expect(result.input.date).toBe(baseInput.date);
    expect(result.changes?.some((c) => c.startsWith("Date moved"))).toBe(false);
  });

  it("accepts a valid new date and reports the move", async () => {
    const generate = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({ ...samplePlan, newTotalBudget: 0, newGuestCount: 60, newDate: "2027-01-09" }),
      );
    const locate = vi.fn().mockResolvedValue(null);
    const result = await refinePlan(baseInput, samplePlan, "Move to January", { generate, locate, now: NOW });
    expect(result.input).toMatchObject({ date: "2027-01-09", guests: 60, budget: baseInput.budget });
    expect(result.changes).toEqual(expect.arrayContaining([expect.stringMatching(/^Date moved from 12 Dec to 9 Jan/)]));
  });
});

describe("assign helpers", () => {
  const team: Member[] = [
    { id: "ma", name: "Asha", role: "Aunt" },
    { id: "mb", name: "Bala", role: "" },
  ];

  it("ignores given owners who are no longer on the team", () => {
    const out = balance(["t_a", "t_b"], team, { t_a: "mgone" });
    expect(Object.values(out).sort()).toEqual(["ma", "mb"]);
  });

  it("labels an unknown event type as a celebration and omits empty roles", () => {
    const prompt = buildAssignPrompt("mystery", samplePlan, team);
    expect(prompt).toMatch(/^Event: Celebration/);
    expect(prompt).toContain("ma: Asha (Aunt)");
    expect(prompt).toContain("mb: Bala\n");
    expect(prompt).toMatch(/v_[a-z0-9]+: Book caterer\n/);
  });
});

describe("rate limiter housekeeping", () => {
  it("clears out expired entries once more than 5,000 visitors are tracked", () => {
    const check = createRateLimiter(1, 1000);
    for (let i = 0; i < 5001; i++) check(`old${i}`, 0);
    // Much later, a new visitor triggers the clean-up; old visitors start fresh.
    expect(check("new", 5000).allowed).toBe(true);
    expect(check("old1", 5000).allowed).toBe(true);
    expect(check("old1", 5001).allowed).toBe(false);
  });

  it("clears out expired entries in combined limiters too", () => {
    const check = combineLimiters({ limit: 1, windowMs: 1000 });
    for (let i = 0; i < 5001; i++) check(`old${i}`, 0);
    expect(check("new", 5000).allowed).toBe(true);
    expect(check("new", 5001).allowed).toBe(false);
  });

  it("keeps entries that have not expired during clean-up", () => {
    const check = createRateLimiter(1, 10_000);
    for (let i = 0; i < 5001; i++) check(`v${i}`, 0);
    expect(check("v5002", 10).allowed).toBe(true);
    expect(check("v0", 20).allowed).toBe(false);
  });
});

describe("schema helpers", () => {
  it("fills in fields missing from plans saved before they existed", () => {
    const old = {
      eventType: "birthday",
      date: "2026-12-12",
      city: "Pune",
      guests: 30,
      budget: 40000,
    } as unknown as EventInput;
    expect(withInputDefaults(old)).toMatchObject({
      focus: [],
      food: "",
      guestNeeds: [],
      traditions: [],
      traditionOther: "",
      days: 1,
      functions: [],
      additions: [],
    });
  });

  it("keeps the first message per field and files top-level errors under 'form'", () => {
    const schema = z.object({ name: z.string().min(3, "Too short").max(1, "Too long") });
    const result = schema.safeParse({ name: "ab" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)).toEqual({ name: "Too short" });
    const top = z.string().safeParse(5);
    expect(top.success).toBe(false);
    if (!top.success) expect(fieldErrors(top.error)).toEqual({ form: expect.any(String) });
  });
});

describe("wrapText without Intl.Segmenter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still breaks a long word by character on older browsers", () => {
    const { Segmenter: _unused, ...rest } = Intl as typeof Intl & { Segmenter: unknown };
    vi.stubGlobal("Intl", rest);
    expect("Segmenter" in Intl).toBe(false);
    expect(wrapText("abcdefghij", 40, (s) => s.length * 10)).toEqual(["abcd", "efgh", "ij"]);
  });
});
