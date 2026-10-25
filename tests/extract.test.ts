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
  const audio = { mimeType: "audio/webm;codecs=opus", data: "A".repeat(200) };

  it("accepts a voice note and normalises its type", () => {
    const parsed = ExtractRequestSchema.safeParse({ audio });
    expect(parsed.success && parsed.data.audio?.mimeType).toBe("audio/webm");
  });

  it("accepts a typed description", () => {
    expect(ExtractRequestSchema.safeParse({ text: "Wedding in Jaipur, 250 guests" }).success).toBe(true);
  });

  it("rejects unsupported formats, bad data and oversized audio", () => {
    expect(ExtractRequestSchema.safeParse({ audio: { ...audio, mimeType: "video/mp4" } }).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ audio: { ...audio, data: "<script>".repeat(30) } }).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ audio: { ...audio, data: "A".repeat(1_500_000) } }).success).toBe(false);
  });

  it("needs exactly one of audio or text", () => {
    expect(ExtractRequestSchema.safeParse({}).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ audio, text: "Wedding in Jaipur, 250 guests" }).success).toBe(false);
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
  it("sends the voice note to the AI with today's date", async () => {
    const generate = vi.fn().mockResolvedValue(JSON.stringify(raw()));
    const result = await extractEventDetails(
      { audio: { mimeType: "audio/webm", data: "QUJD" } },
      { generate, now: NOW },
    );
    const request = generate.mock.calls[0][0];
    expect(request.audio).toEqual({ mimeType: "audio/webm", data: "QUJD" });
    expect(request.prompt).toContain("Saturday, 2026-10-24");
    expect(request.temperature).toBeLessThan(0.5);
    expect(result.transcript).toContain("Bengaluru");
  });

  it("wraps typed text as data", async () => {
    const generate = vi.fn().mockResolvedValue(JSON.stringify(raw()));
    await extractEventDetails({ text: "Birthday in Bengaluru for 40" }, { generate, now: NOW });
    const request = generate.mock.calls[0][0];
    expect(request.audio).toBeUndefined();
    expect(request.prompt).toMatch(/<user_details>\nBirthday in Bengaluru for 40\n<\/user_details>/);
  });
});
