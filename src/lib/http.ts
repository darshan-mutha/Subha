import { NextResponse } from "next/server";
import type { z } from "zod";
import { HttpError } from "./errors";
import { clientKey, combineLimiters, createRateLimiter } from "./rateLimit";
import { fieldErrors } from "./schemas";

const DEFAULT_MAX_BODY_BYTES = 32_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * AI calls cost money, so each visitor gets a per-minute and a per-day limit,
 * and the whole app has an hourly ceiling as a cost safety net. Saving ticks
 * is cheap and gets a looser limit.
 */
const limiters = {
  ai: combineLimiters(
    { limit: 10, windowMs: MINUTE },
    { limit: envNumber("AI_DAILY_LIMIT_PER_VISITOR", 50), windowMs: DAY },
  ),
  data: createRateLimiter(90, MINUTE),
};
const aiGlobal = createRateLimiter(envNumber("AI_HOURLY_LIMIT_TOTAL", 300), HOUR);

/**
 * Blocks requests sent from other websites (cross-site request forgery, or
 * another site spending Shubā's AI quota through its visitors' browsers).
 */
export function isCrossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

const JSON_HEADERS = { "Cache-Control": "no-store" };

/** A JSON reply that browsers and proxies never cache. */
export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: JSON_HEADERS });
}

/** A JSON error reply: `{ error, fields }` with the given status. */
export function errorResponse(message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json({ error: message, fields }, { status, headers: JSON_HEADERS });
}

/**
 * Shared request handling for the API routes: rate limiting, body size limit,
 * JSON parsing, schema validation and safe error messages.
 */
export async function handleJson<S extends z.ZodTypeAny, R>(
  request: Request,
  schema: S,
  run: (data: z.infer<S>) => Promise<R>,
  { maxBytes = DEFAULT_MAX_BODY_BYTES, kind = "ai" }: { maxBytes?: number; kind?: keyof typeof limiters } = {},
): Promise<NextResponse> {
  if (isCrossSite(request)) return errorResponse("This request is not allowed.", 403);

  if (kind === "ai" && process.env.AI_DISABLED === "1") {
    return errorResponse("Planning is paused for a short while. Please try again later.", 503);
  }

  const rate = limiters[kind](clientKey(request.headers));
  if (!rate.allowed) {
    const wait = rate.retryAfterSec > 120 ? "Please try again tomorrow." : "Please wait a minute and try again.";
    const res = errorResponse(`Too many requests. ${wait}`, 429);
    res.headers.set("Retry-After", String(rate.retryAfterSec));
    return res;
  }
  if (kind === "ai") {
    const total = aiGlobal("all");
    if (!total.allowed) {
      const res = errorResponse("Shubā is very busy right now. Please try again in a little while.", 503);
      res.headers.set("Retry-After", String(total.retryAfterSec));
      return res;
    }
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("Please send JSON.", 415);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return errorResponse("Request is too large.", 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse("Request is not valid JSON.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Please check the highlighted fields.", 400, fieldErrors(parsed.error));
  }

  return withErrors(async () => NextResponse.json(await run(parsed.data), { headers: JSON_HEADERS }), {
    log: "Planner failure:",
    message: "Something went wrong while planning. Please try again.",
  });
}

/**
 * Runs a route handler and turns failures into safe replies: an HttpError
 * keeps its status, message and field errors; anything else is logged (message
 * only) and answered with a friendly 500.
 */
export async function withErrors(
  handle: () => Promise<NextResponse>,
  { log, message }: { log: string; message: string },
): Promise<NextResponse> {
  try {
    return await handle();
  } catch (error) {
    if (error instanceof HttpError) return errorResponse(error.message, error.status, error.fields);
    console.error(log, error instanceof Error ? error.message : "unknown error");
    return errorResponse(message, 500);
  }
}
