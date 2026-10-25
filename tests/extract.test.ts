import { describe, expect, it, vi } from "vitest";
import { ExtractRequestSchema, cleanExtraction, extractEventDetails, type RawExtraction } from "@/lib/extract";
import { NOW } from "./fixtures";

const raw = (over: Partial<RawExtraction> = {}): RawExtraction => ({
  transcript: "Beti ka paanchva birthday, 12 December, Bengaluru, 40 log, pachaas hazaar",
  eventType: "birthday",
  eventName: "Daughter's 5th birthday",
  date: "2026-12-12",
  city: "Bengaluru",
  guests: 40,
  budget: 50000,
  style: "Jungle",
  notes: "",
  ...over,
});

describe("ExtractRequestSchema", () => {
  it("accepts a typed or spoken description in Indian scripts", () => {
    expect(ExtractRequestSchema.safeParse({ text: "Wedding in Jaipur, 250 guests" }).success).toBe(true);
    expect(ExtractRequestSchema.safeParse({ text: "बेटी का जन्मदिन, बेंगलुरु, 40 लोग" }).success).toBe(true);
  });

  it("rejects short, missing, oversized or markup text", () => {
    expect(ExtractRequestSchema.safeParse({}).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ text: "hi" }).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ text: "a".repeat(600) }).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ text: "<script>alert(1)</script> party" }).success).toBe(false);
  });

  it("no longer accepts raw audio", () => {
    const parsed = ExtractRequestSchema.safeParse({ audio: { mimeType: "audio/webm", data: "A".repeat(200) } });
    expect(parsed.success).toBe(false);
  });
});

describe("cleanExtraction", () => {
  it("keeps valid values and reports nothing missing", () => {
    const result = cleanExtraction(raw(), NOW);
    expect(result.missing).toEqual([]);
    expect(result.values).toMatchObject({ eventType: "birthday", guests: "40", budget: "50000", city: "Bengaluru" });
    expect(result.values.includeMuhurat).toBe(false);
  });

  it("drops invalid or unmentioned values and lists them as missing", () => {
    const result = cleanExtraction(raw({ date: "2020-01-01", budget: 0, city: "", eventType: "party" }), NOW);
    expect(result.values.date).toBe("");
    expect(result.values.budget).toBe("");
    expect(result.missing).toEqual(["eventType", "date", "city", "budget"]);
  });

  it("switches on auspicious timings for traditional events", () => {
    expect(cleanExtraction(raw({ eventType: "housewarming" }), NOW).values.includeMuhurat).toBe(true);
  });

  it("rounds budgets and rejects absurd guest counts", () => {
    const result = cleanExtraction(raw({ budget: 150000.6, guests: 99999 }), NOW);
    expect(result.values.budget).toBe("150001");
    expect(result.values.guests).toBe("");
  });
});

describe("extractEventDetails", () => {
  it("wraps the host's words as data, with today's date and a small reply cap", async () => {
    const generate = vi.fn().mockResolvedValue(JSON.stringify(raw()));
    const result = await extractEventDetails({ text: "Birthday in Bengaluru for 40" }, { generate, now: NOW });
    const request = generate.mock.calls[0][0];
    expect(request.prompt).toContain("Saturday, 2026-10-24");
    expect(request.prompt).toMatch(/<user_details>\nBirthday in Bengaluru for 40\n<\/user_details>/);
    expect(request.maxTokens).toBeLessThanOrEqual(2000);
    expect(result.transcript).toContain("Bengaluru");
  });
});
