import { describe, expect, it } from "vitest";
import { calculateTimings, sunEvent, weekdayOf, type Location } from "@/lib/muhurat";

const BENGALURU: Location = { name: "Bengaluru", latitude: 12.9716, longitude: 77.5946, timeZone: "Asia/Kolkata" };

function minutesIST(date: Date): number {
  const ist = new Date(date.getTime() + 330 * 60_000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

describe("sunrise and sunset", () => {
  it("matches published Bengaluru times within 3 minutes", () => {
    // Published: sunrise 6:11 AM, sunset 5:56 PM on 23 Oct 2026
    const rise = sunEvent("2026-10-23", BENGALURU.latitude, BENGALURU.longitude, "sunrise")!;
    const set = sunEvent("2026-10-23", BENGALURU.latitude, BENGALURU.longitude, "sunset")!;
    expect(Math.abs(minutesIST(rise) - (6 * 60 + 11))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutesIST(set) - (17 * 60 + 56))).toBeLessThanOrEqual(3);
  });

  it("returns null during polar night", () => {
    expect(sunEvent("2026-12-21", 78.2, 15.6, "sunrise")).toBeNull();
    expect(
      calculateTimings("2026-12-21", {
        name: "Svalbard",
        latitude: 78.2,
        longitude: 15.6,
        timeZone: "Arctic/Longyearbyen",
      }),
    ).toBeNull();
  });
});

describe("Rahu Kalam, Yamagandam and Gulika Kalam", () => {
  it("knows the weekday of a date", () => {
    expect(weekdayOf("2026-10-23")).toBe(5); // Friday
  });

  it("uses the 4th daytime part for Rahu Kalam on Friday", () => {
    const t = calculateTimings("2026-10-23", BENGALURU)!;
    expect(t.weekday).toBe("Friday");
    expect(t.rahuKalam).toEqual({ start: "10:35 AM", end: "12:03 PM" });
    expect(t.gulikaKalam.start).toBe("7:39 AM");
    expect(t.yamagandam.start).toBe("3:00 PM");
  });

  it("puts Rahu Kalam in the 2nd part on Monday and 8th part on Sunday", () => {
    const monday = calculateTimings("2026-10-26", BENGALURU)!;
    expect(monday.rahuKalam.start.startsWith("7:")).toBe(true);
    const sunday = calculateTimings("2026-10-25", BENGALURU)!;
    expect(sunday.rahuKalam.end).toBe(sunday.sunset);
  });

  it("lists better windows that avoid all three periods", () => {
    const t = calculateTimings("2026-10-23", BENGALURU)!;
    expect(t.betterWindows.length).toBeGreaterThan(0);
    const blockedStarts = [t.rahuKalam.start, t.yamagandam.start, t.gulikaKalam.start];
    for (const w of t.betterWindows) expect(blockedStarts).not.toContain(w.start);
  });
});
