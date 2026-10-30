import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  fullDate,
  longDate,
  shortDate,
  shortDateWithYear,
  shortWeekday,
  todayIST,
} from "@/lib/dates";

describe("dates", () => {
  it("adds and counts calendar days across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-12-12", -28)).toBe("2026-11-14");
    expect(daysBetween("2026-10-24", "2026-12-12")).toBe(49);
    expect(daysBetween("2026-12-12", "2026-10-24")).toBe(-49);
  });

  it("reads today in India, not UTC", () => {
    expect(todayIST(new Date("2026-10-23T20:00:00Z"))).toBe("2026-10-24");
    expect(todayIST(new Date("2026-10-23T18:00:00Z"))).toBe("2026-10-23");
  });

  it("formats a date in each style", () => {
    expect(shortDate("2027-01-09")).toBe("9 Jan");
    expect(shortDateWithYear("2027-01-09")).toBe("9 Jan 2027");
    expect(longDate("2027-10-27")).toBe("27 October 2027");
    expect(fullDate("2027-10-27")).toBe("Wednesday, 27 October 2027");
    expect(shortWeekday("2027-10-27")).toBe("Wed");
  });

  it("returns text that is not a date unchanged", () => {
    expect(shortDateWithYear("")).toBe("");
    expect(fullDate("soon")).toBe("soon");
    expect(Number.isNaN(daysBetween("", "2026-01-01"))).toBe(true);
  });
});
