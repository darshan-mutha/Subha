// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as Card from "@/components/WeatherCard";

const { WeatherCard } = await vi.importActual<typeof Card>("@/components/WeatherCard");

function stubWeather(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("WeatherCard", () => {
  it("shows the usual weather for a date far away, with no accessibility issues", async () => {
    stubWeather({
      kind: "usual",
      place: "Bangalore",
      min: 19,
      max: 27,
      rain: "likely",
      rainyShare: 0.6,
      years: 10,
      days: [],
      forecastFrom: "2027-10-12",
    });
    const { container } = render(<WeatherCard city="Bangalore" date="2027-10-27" days={1} />);
    expect(await screen.findByText("Usually 19–27°C, rain likely")).toBeInTheDocument();
    expect(screen.getByText(/about 6 in 10 days over the past 10 years/)).toBeInTheDocument();
    expect(screen.getByText(/real forecast from 12 Oct 2027/)).toBeInTheDocument();
    const result = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });

  it("shows the forecast day by day for a multi-day event", async () => {
    stubWeather({
      kind: "forecast",
      place: "Jaipur",
      min: 14,
      max: 28,
      rain: "low",
      rainyShare: null,
      years: 0,
      days: [
        { date: "2026-11-06", min: 15, max: 28, rainChance: 0, code: 0 },
        { date: "2026-11-07", min: 14, max: 27, rainChance: 30, code: 2 },
      ],
      forecastFrom: null,
    });
    render(<WeatherCard city="Jaipur" date="2026-11-06" days={2} />);
    expect(await screen.findByText("Forecast: 14–28°C, mostly dry")).toBeInTheDocument();
    expect(screen.getByText(/Day 1 Fri: 15–28°C, clear/)).toBeInTheDocument();
    expect(screen.getByText(/Day 2 Sat: 14–27°C, partly cloudy, 30% chance of rain/)).toBeInTheDocument();
  });

  it("says it hardly ever rains when past years were dry", async () => {
    stubWeather({
      kind: "usual",
      place: "Jaipur",
      min: 11,
      max: 25,
      rain: "low",
      rainyShare: 0.02,
      years: 10,
      days: [],
      forecastFrom: "2027-01-29",
    });
    render(<WeatherCard city="Jaipur" date="2027-02-11" days={3} />);
    expect(await screen.findByText(/it hardly ever rained over the past 10 years/)).toBeInTheDocument();
    expect(screen.getByText(/Cool evenings/)).toBeInTheDocument();
  });

  it("stays hidden when the weather is not available", async () => {
    stubWeather({ error: "nope" }, false);
    const { container } = render(<WeatherCard city="Jaipur" date="2026-11-06" days={1} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
