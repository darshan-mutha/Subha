import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocationCache } from "@/lib/locations";
import {
  addDays,
  clearWeatherCache,
  daysBetween,
  describeCode,
  getWeather,
  rainLevel,
  summariseForecast,
  summariseUsual,
  todayIst,
  WeatherRequestSchema,
  weatherTip,
} from "@/lib/weather";

const NOW = new Date("2026-10-29T07:00:00Z"); // 29 Oct 2026, 12:30 IST

function json(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

/** Daily data for every date from start to end, with values from a function. */
function series(start: string, end: string, f: (d: string) => { max: number; min: number; rain: number }) {
  const time: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) time.push(d);
  return {
    time,
    temperature_2m_max: time.map((d) => f(d).max),
    temperature_2m_min: time.map((d) => f(d).min),
    precipitation_sum: time.map((d) => f(d).rain),
  };
}

beforeEach(() => {
  clearWeatherCache();
  clearLocationCache();
});

describe("weather helpers", () => {
  it("does date sums and today in India", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-10-29", "2026-11-14")).toBe(16);
    expect(todayIst(new Date("2026-10-29T20:00:00Z"))).toBe("2026-10-30");
  });

  it("turns numbers into plain words", () => {
    expect(rainLevel(0.6)).toBe("likely");
    expect(rainLevel(0.3)).toBe("some");
    expect(rainLevel(0.05)).toBe("low");
    expect(describeCode(0).label).toBe("clear");
    expect(describeCode(63).label).toBe("rain");
    expect(describeCode(95).label).toBe("thunderstorms");
    expect(describeCode(81).label).toBe("showers");
    expect(describeCode(null).label).toBe("");
    expect(weatherTip({ min: 20, max: 28, rain: "likely" })).toMatch(/covered/);
    expect(weatherTip({ min: 25, max: 40, rain: "low" })).toMatch(/hot/);
    expect(weatherTip({ min: 20, max: 30, rain: "some" })).toMatch(/backup/);
    expect(weatherTip({ min: 9, max: 22, rain: "low" })).toMatch(/Cool evenings/);
    expect(weatherTip({ min: 18, max: 28, rain: "low" })).toMatch(/Pleasant/);
  });

  it("checks the request", () => {
    expect(WeatherRequestSchema.safeParse({ city: "Jaipur", date: "2027-01-01" }).success).toBe(true);
    expect(WeatherRequestSchema.safeParse({ city: "", date: "2027-01-01" }).success).toBe(false);
    expect(WeatherRequestSchema.safeParse({ city: "Jaipur", date: "1 Jan" }).success).toBe(false);
    expect(WeatherRequestSchema.safeParse({ city: "Jaipur", date: "2027-01-01", days: 9 }).success).toBe(false);
  });
});

describe("summaries", () => {
  it("keeps only the event days of a forecast", () => {
    const w = summariseForecast(
      {
        time: ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"],
        temperature_2m_max: [30, 28.4, 27.6, 26],
        temperature_2m_min: [16, 15.2, 14, 13],
        precipitation_probability_max: [90, 10, 30, 0],
        weather_code: [61, 0, 2, 0],
      },
      "2026-11-06",
      "2026-11-07",
      "Jaipur",
    );
    expect(w.kind).toBe("forecast");
    expect(w.days.map((d) => d.date)).toEqual(["2026-11-06", "2026-11-07"]);
    expect([w.min, w.max]).toEqual([14, 28]);
    expect(w.rain).toBe("some");
  });

  it("averages the same dates over past years", () => {
    const daily = series("2016-10-01", "2026-11-30", (d) => ({
      max: 27,
      min: 19,
      rain: d.endsWith("-10-27") || d.endsWith("-10-28") ? 5 : 0,
    }));
    const w = summariseUsual(daily, "2027-10-27", 1, 2017, 2026, "Bangalore", "2027-10-12");
    expect(w.kind).toBe("usual");
    expect([w.min, w.max]).toEqual([19, 27]);
    expect(w.years).toBe(10);
    expect(w.rainyShare).toBe(0.29); // 2 of 7 days each year
    expect(w.rain).toBe("some");
    expect(w.forecastFrom).toBe("2027-10-12");
  });

  it("gives nothing when the data is empty", () => {
    expect(summariseForecast({}, "2026-11-06", "2026-11-06", "X").kind).toBe("none");
    expect(summariseUsual({}, "2027-10-27", 1, 2017, 2026, "X", "2027-10-12").kind).toBe("none");
  });
});

describe("getWeather", () => {
  it("uses the real forecast within 16 days", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("api.open-meteo.com/v1/forecast");
      return json({
        daily: {
          time: ["2026-11-06"],
          temperature_2m_max: [28],
          temperature_2m_min: [15],
          precipitation_probability_max: [5],
          weather_code: [0],
        },
      });
    }) as unknown as typeof fetch;
    const w = await getWeather({ city: "Jaipur", date: "2026-11-06", days: 1 }, { fetcher, now: NOW });
    expect(w.kind).toBe("forecast");
    expect(w.rain).toBe("low");
    // Cached: no second call.
    await getWeather({ city: "Jaipur", date: "2026-11-06", days: 1 }, { fetcher, now: NOW });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses the past 10 years for dates further away", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      expect(u.host).toBe("archive-api.open-meteo.com");
      expect(u.searchParams.get("start_date")).toBe("2016-10-24");
      expect(u.searchParams.get("end_date")).toBe("2025-10-30");
      return json({ daily: series("2016-10-24", "2025-10-30", () => ({ max: 26.6, min: 19.4, rain: 3 })) });
    }) as unknown as typeof fetch;
    const w = await getWeather({ city: "Bangalore", date: "2027-10-27", days: 1 }, { fetcher, now: NOW });
    expect(w).toMatchObject({ kind: "usual", min: 19, max: 27, rain: "likely", years: 10, forecastFrom: "2027-10-12" });
  });

  it("gives nothing for past events, unknown places or failed lookups", async () => {
    const failing = vi.fn(async () => json({}, false)) as unknown as typeof fetch;
    expect(
      (await getWeather({ city: "Jaipur", date: "2026-10-01", days: 1 }, { fetcher: failing, now: NOW })).kind,
    ).toBe("none");
    expect(failing).not.toHaveBeenCalled();
    expect(
      (await getWeather({ city: "Nowhere town", date: "2027-01-01", days: 1 }, { fetcher: failing, now: NOW })).kind,
    ).toBe("none");
    const throwing = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(
      (await getWeather({ city: "Jaipur", date: "2027-01-01", days: 1 }, { fetcher: throwing, now: NOW })).kind,
    ).toBe("none");
  });
});

describe("POST /api/weather", () => {
  it("rejects a bad request without calling the weather service", async () => {
    const { POST } = await import("@/app/api/weather/route");
    const res = await POST(
      new Request("http://localhost/api/weather", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" },
        body: JSON.stringify({ city: "", date: "soon" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
