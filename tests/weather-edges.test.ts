import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocationCache } from "@/lib/locations";
import { addDays, clearWeatherCache, describeCode, getWeather, summariseForecast, summariseUsual } from "@/lib/weather";

const NOW = new Date("2026-10-29T07:00:00Z"); // 29 Oct 2026 in India

function json(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

function fetcherReturning(response: Response) {
  return vi.fn(async () => response) as unknown as typeof fetch;
}

beforeEach(() => {
  clearWeatherCache();
  clearLocationCache();
});

describe("describeCode edge codes", () => {
  it("labels partly cloudy, cloudy, fog, drizzle and snow codes", () => {
    expect(describeCode(1)).toEqual({ label: "partly cloudy", icon: "🌤️" });
    expect(describeCode(3).label).toBe("cloudy");
    expect(describeCode(45).label).toBe("foggy");
    expect(describeCode(48).label).toBe("foggy");
    expect(describeCode(53).label).toBe("drizzle");
    expect(describeCode(73).label).toBe("snow");
  });

  it("falls back to a blank label for codes outside every known band", () => {
    expect(describeCode(10)).toEqual({ label: "", icon: "🌤️" });
    expect(describeCode(90)).toEqual({ label: "", icon: "🌤️" });
  });
});

describe("summariseForecast with gaps in the data", () => {
  it("skips days with missing temperatures and treats missing rain and code as null", () => {
    const w = summariseForecast(
      {
        time: ["2026-11-06", "2026-11-07", "2026-11-08"],
        temperature_2m_max: [30, null, 29],
        temperature_2m_min: [18, 17, 16],
      },
      "2026-11-06",
      "2026-11-08",
      "Jaipur",
    );
    expect(w.days.map((d) => d.date)).toEqual(["2026-11-06", "2026-11-08"]);
    expect(w.days[0]).toMatchObject({ rainChance: null, code: null });
    expect(w.rain).toBe("low");
  });

  it("returns nothing when every day in range lacks a temperature", () => {
    const w = summariseForecast(
      { time: ["2026-11-06"], temperature_2m_max: [30], temperature_2m_min: [null] },
      "2026-11-06",
      "2026-11-06",
      "Jaipur",
    );
    expect(w.kind).toBe("none");
  });
});

describe("summariseUsual with gaps in the data", () => {
  it("returns nothing when only maximums were recorded", () => {
    const w = summariseUsual(
      { time: ["2025-10-27"], temperature_2m_max: [28], temperature_2m_min: [null], precipitation_sum: [0] },
      "2027-10-27",
      1,
      2025,
      2025,
      "Pune",
      "2027-10-12",
    );
    expect(w.kind).toBe("none");
  });

  it("reports a zero rain share when no rainfall was measured", () => {
    const w = summariseUsual(
      { time: ["2025-10-27"], temperature_2m_max: [28], temperature_2m_min: [18], precipitation_sum: [null] },
      "2027-10-27",
      1,
      2025,
      2025,
      "Pune",
      "2027-10-12",
    );
    expect(w).toMatchObject({ kind: "usual", rainyShare: 0, rain: "low", years: 1 });
  });

  it("uses 28 Feb in past years for an event on 29 Feb", () => {
    const time: string[] = [];
    for (let d = "2025-02-25"; d <= "2025-03-03"; d = addDays(d, 1)) time.push(d);
    const w = summariseUsual(
      {
        time,
        temperature_2m_max: time.map(() => 30),
        temperature_2m_min: time.map(() => 15),
        precipitation_sum: time.map(() => 0),
      },
      "2028-02-29",
      1,
      2025,
      2025,
      "Delhi",
      "2028-02-14",
    );
    expect(w).toMatchObject({ kind: "usual", min: 15, max: 30, years: 1 });
  });
});

describe("getWeather fallbacks", () => {
  it("gives nothing when the forecast service answers with an error status", async () => {
    const fetcher = fetcherReturning(json({}, false));
    const w = await getWeather({ city: "Jaipur", date: "2026-11-06", days: 1 }, { fetcher, now: NOW });
    expect(w.kind).toBe("none");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("gives nothing when the forecast response has no daily block", async () => {
    const fetcher = fetcherReturning(json({ hourly: {} }));
    const w = await getWeather({ city: "Jaipur", date: "2026-11-06", days: 1 }, { fetcher, now: NOW });
    expect(w.kind).toBe("none");
  });

  it("does not cache an empty result, so the next call tries again", async () => {
    const fetcher = fetcherReturning(json({}, false));
    await getWeather({ city: "Jaipur", date: "2026-11-06", days: 1 }, { fetcher, now: NOW });
    await getWeather({ city: "Jaipur", date: "2026-11-06", days: 1 }, { fetcher, now: NOW });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("treats a missing day count as a one-day event", async () => {
    const fetcher = fetcherReturning(
      json({
        daily: {
          time: ["2026-11-06", "2026-11-07"],
          temperature_2m_max: [28, 35],
          temperature_2m_min: [15, 20],
          precipitation_probability_max: [5, 5],
          weather_code: [0, 0],
        },
      }),
    );
    const req = { city: "Jaipur", date: "2026-11-06" } as { city: string; date: string; days: number };
    const w = await getWeather(req, { fetcher, now: NOW });
    expect(w.days.map((d) => d.date)).toEqual(["2026-11-06"]);
  });

  it("keeps usual-weather results cached for longer than a forecast would be", async () => {
    const time: string[] = [];
    for (let d = "2016-10-24"; d <= "2025-10-30"; d = addDays(d, 1)) time.push(d);
    const fetcher = fetcherReturning(
      json({
        daily: {
          time,
          temperature_2m_max: time.map(() => 27),
          temperature_2m_min: time.map(() => 19),
          precipitation_sum: time.map(() => 0),
        },
      }),
    );
    const req = { city: "Bangalore", date: "2027-10-27", days: 1 };
    await getWeather(req, { fetcher, now: NOW });
    // Four hours later is past the forecast cache time but well within the usual-weather one.
    const later = new Date(NOW.getTime() + 4 * 60 * 60 * 1000);
    const w = await getWeather(req, { fetcher, now: later });
    expect(w.kind).toBe("usual");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("gives nothing when the history service fails for far-off dates", async () => {
    const fetcher = fetcherReturning(json({}, false));
    const w = await getWeather({ city: "Bangalore", date: "2027-10-27", days: 1 }, { fetcher, now: NOW });
    expect(w.kind).toBe("none");
  });
});
