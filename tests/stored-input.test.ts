import { describe, expect, it } from "vitest";
import { makeEventInputSchema, StoredEventInputSchema } from "@/lib/schemas";
import { baseInput, NOW } from "./fixtures";

describe("event details of a saved plan", () => {
  it("accepts a date in the past, which the form does not", () => {
    const past = { ...baseInput, date: "2020-01-01" };
    expect(StoredEventInputSchema.safeParse(past).success).toBe(true);
    expect(makeEventInputSchema(NOW, { allowPast: true }).safeParse(past).success).toBe(true);
    expect(makeEventInputSchema(NOW).safeParse(past).success).toBe(false);
  });

  it("keeps every other rule", () => {
    expect(StoredEventInputSchema.safeParse({ ...baseInput, date: "2026-02-30" }).success).toBe(false);
    expect(StoredEventInputSchema.safeParse({ ...baseInput, date: "2099-01-01" }).success).toBe(false);
    expect(StoredEventInputSchema.safeParse({ ...baseInput, guests: 0 }).success).toBe(false);
  });
});
