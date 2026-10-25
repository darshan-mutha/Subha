import { NextResponse } from "next/server";
import type { z } from "zod";
import { PlannerError } from "./gemini";
import { clientKey, createRateLimiter } from "./rateLimit";
import { fieldErrors } from "./schemas";

const DEFAULT_MAX_BODY_BYTES = 32_000;
/** AI calls are expensive, so they get a tighter limit than saving ticks. */
const limiters = {
  ai: createRateLimiter(10, 60_000),
  data: createRateLimiter(90, 60_000),
};

const JSON_HEADERS = { "Cache-Control": "no-store" };

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: JSON_HEADERS });
}

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
  const rate = limiters[kind](clientKey(request.headers));
  if (!rate.allowed) {
    const res = errorResponse("Too many requests. Please wait a minute and try again.", 429);
    res.headers.set("Retry-After", String(rate.retryAfterSec));
    return res;
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("Please send JSON.", 415);
  }

  const text = await request.text();
  if (text.length > maxBytes) return errorResponse("Request is too large.", 413);

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

  try {
    const result = await run(parsed.data);
    return NextResponse.json(result, { headers: JSON_HEADERS });
  } catch (error) {
    if (error instanceof PlannerError) return errorResponse(error.message, error.status);
    console.error("Planner failure:", error instanceof Error ? error.message : "unknown error");
    return errorResponse("Something went wrong while planning. Please try again.", 500);
  }
}
