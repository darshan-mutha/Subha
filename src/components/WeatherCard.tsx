"use client";

import { useEffect, useState } from "react";
import { requestWeather } from "@/lib/client";
import { shortDateWithYear, shortWeekday } from "@/lib/dates";
import { describeCode, weatherTip, type WeatherSummary } from "@/lib/weather";

const RAIN_WORDS = { low: "mostly dry", some: "some chance of rain", likely: "rain likely" } as const;

/** Shows the forecast (within 16 days) or the usual weather for the event. Quietly hidden if unavailable. */
export function WeatherCard({ city, date, days }: { city: string; date: string; days: number }) {
  const key = `${city}|${date}|${days}`;
  const [result, setResult] = useState<{ key: string; weather: WeatherSummary | null } | null>(null);

  useEffect(() => {
    let live = true;
    requestWeather({ city, date, days })
      .then((w) => live && setResult({ key, weather: w }))
      .catch(() => live && setResult({ key, weather: null }));
    return () => {
      live = false;
    };
  }, [key, city, date, days]);

  // Older results (from before the city or date changed) are not shown.
  const weather = result?.key === key ? result.weather : null;
  if (!weather || weather.kind === "none") return null;

  const range = `${weather.min}–${weather.max}°C`;
  const tip = weatherTip(weather);

  if (weather.kind === "usual") {
    const icon = weather.rain === "likely" ? "🌦️" : weather.rain === "some" ? "⛅" : "☀️";
    const share = Math.round((weather.rainyShare ?? 0) * 10);
    return (
      <section className="weather" aria-label="Weather">
        <span className="weather-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <p className="weather-title">
            Usually {range}, {RAIN_WORDS[weather.rain]}
          </p>
          <p className="small">
            {share === 0
              ? `Around these dates in ${city}, it hardly ever rained over the past ${weather.years} years.`
              : `Around these dates in ${city}, it rained on about ${share} in 10 days over the past ${weather.years} years.`}{" "}
            {tip}
          </p>
          <p className="weather-tag">
            Based on the past {weather.years} years
            {weather.forecastFrom && ` · real forecast from ${shortDateWithYear(weather.forecastFrom)}`}
          </p>
        </div>
      </section>
    );
  }

  const first = describeCode(weather.days[0]?.code ?? null);
  return (
    <section className="weather" aria-label="Weather forecast">
      <span className="weather-icon" aria-hidden="true">
        {first.icon}
      </span>
      <div>
        <p className="weather-title">
          Forecast: {range}, {RAIN_WORDS[weather.rain]}
        </p>
        <p className="small">
          {weather.days.map((d, i) => {
            const words = describeCode(d.code).label;
            const prefix = weather.days.length > 1 ? `Day ${i + 1} ${shortWeekday(d.date)}` : shortWeekday(d.date);
            const rain = d.rainChance !== null && d.rainChance >= 20 ? `, ${d.rainChance}% chance of rain` : "";
            return (
              <span key={d.date} className="weather-day">
                {prefix}: {d.min}–{d.max}°C{words && `, ${words}`}
                {rain}
                {i < weather.days.length - 1 ? " · " : ". "}
              </span>
            );
          })}
          {tip}
        </p>
        <p className="weather-tag">Forecast · it can change, check again closer to the day</p>
      </div>
    </section>
  );
}
