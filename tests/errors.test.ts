import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PlannerError as PlannerFromAi } from "@/lib/ai";
import { HttpError, PLAN_NOT_FOUND, PlannerError } from "@/lib/errors";
import { handleJson, jsonResponse, withErrors } from "@/lib/http";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const opts = { log: "Load failure:", message: "Could not load. Please try again." };

describe("HttpError and PlannerError", () => {
  it("keeps status and field messages, and PlannerError is still importable from ai", () => {
    const err = new PlannerError("Pick a later date.", 422, { date: "Too soon" });
    expect(err).toBeInstanceOf(HttpError);
    expect(PlannerFromAi).toBe(PlannerError);
    expect(err).toMatchObject({ name: "PlannerError", status: 422, fields: { date: "Too soon" } });
    expect(new HttpError(PLAN_NOT_FOUND, 404).fields).toBeUndefined();
  });
});

describe("withErrors", () => {
  it("returns the handler's reply when nothing fails", async () => {
    const res = await withErrors(async () => jsonResponse({ ok: true }), opts);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("passes an HttpError's status, message and fields through", async () => {
    const res = await withErrors(async () => {
      throw new HttpError("Please check your reply.", 400, { name: "Required" });
    }, opts);
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "Please check your reply.", fields: { name: "Required" } });
  });

  it("hides unexpected errors behind a friendly 500 and logs only the message", async () => {
    const res = await withErrors(async () => {
      throw new Error("secret detail");
    }, opts);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Could not load. Please try again." });
    expect(console.error).toHaveBeenCalledWith("Load failure:", "secret detail");
  });
});

describe("request size", () => {
  it("measures the body in bytes, not characters", async () => {
    const schema = z.object({ name: z.string() });
    const body = JSON.stringify({ name: "शुभ".repeat(20) }); // 60 characters of 3 bytes each
    const request = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.40" },
      body,
    });
    expect(body.length).toBeLessThan(100);
    const res = await handleJson(request, schema, async () => ({ ok: true }), { maxBytes: 100, kind: "data" });
    expect(res.status).toBe(413);
  });
});
