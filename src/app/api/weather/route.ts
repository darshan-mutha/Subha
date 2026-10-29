import { getWeather, WeatherRequestSchema } from "@/lib/weather";
import { handleJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 20;

/** Forecast or usual weather for the event's city and dates. No AI involved. */
export async function POST(request: Request) {
  return handleJson(request, WeatherRequestSchema, (body) => getWeather(body), { maxBytes: 1_000, kind: "data" });
}
