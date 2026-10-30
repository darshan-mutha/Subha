import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type * as HttpLib from "@/lib/http";

type HttpModule = typeof HttpLib;

const schema = z.object({ name: z.string().min(1) });

let ip = 0;
function post(body: unknown, headers: Record<string, string> = {}) {
  ip++;
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `172.16.0.${ip}`, ...headers },
    body: JSON.stringify(body),
  });
}

async function freshHttp(env: Record<string, string> = {}): Promise<HttpModule> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/lib/http");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isCrossSite", () => {
  it("compares the origin with the request URL's host when no host headers are sent", async () => {
    const { isCrossSite } = await freshHttp();
    const same = new Request("http://localhost:3000/api/x", { headers: { origin: "http://localhost:3000" } });
    const other = new Request("http://localhost:3000/api/x", { headers: { origin: "http://evil.example" } });
    expect(isCrossSite(same)).toBe(false);
    expect(isCrossSite(other)).toBe(true);
  });

  it("prefers x-forwarded-host over the host header", async () => {
    const { isCrossSite } = await freshHttp();
    const req = new Request("http://internal/api/x", {
      headers: { origin: "https://shuba.app", "x-forwarded-host": "shuba.app", host: "internal" },
    });
    expect(isCrossSite(req)).toBe(false);
  });

  it("treats an origin that is not a valid URL as cross-site", async () => {
    const { isCrossSite } = await freshHttp();
    const req = new Request("http://localhost/api/x", { headers: { origin: "not a url" } });
    expect(isCrossSite(req)).toBe(true);
  });
});

describe("handleJson limits from the environment", () => {
  it("tells the visitor to come back tomorrow once the daily AI limit is used up", async () => {
    const { handleJson } = await freshHttp({ AI_DAILY_LIMIT_PER_VISITOR: "2" });
    const run = vi.fn(async () => ({ ok: true }));
    const headers = { "x-forwarded-for": "203.0.113.7" };
    expect((await handleJson(post({ name: "a" }, headers), schema, run)).status).toBe(200);
    expect((await handleJson(post({ name: "a" }, headers), schema, run)).status).toBe(200);
    const res = await handleJson(post({ name: "a" }, headers), schema, run);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/tomorrow/);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(120);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("ignores a zero or non-numeric limit and keeps the default", async () => {
    const { handleJson } = await freshHttp({ AI_DAILY_LIMIT_PER_VISITOR: "0", AI_HOURLY_LIMIT_TOTAL: "lots" });
    const run = vi.fn(async () => ({ ok: true }));
    const headers = { "x-forwarded-for": "203.0.113.8" };
    for (let i = 0; i < 3; i++) {
      expect((await handleJson(post({ name: "a" }, headers), schema, run)).status).toBe(200);
    }
  });

  it("returns 503 with Retry-After when the app-wide hourly AI ceiling is reached", async () => {
    const { handleJson } = await freshHttp({ AI_HOURLY_LIMIT_TOTAL: "1" });
    const run = vi.fn(async () => ({ ok: true }));
    expect((await handleJson(post({ name: "a" }), schema, run)).status).toBe(200);
    const res = await handleJson(post({ name: "b" }), schema, run);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/very busy/);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not count data requests against the hourly AI ceiling", async () => {
    const { handleJson } = await freshHttp({ AI_HOURLY_LIMIT_TOTAL: "1" });
    const run = vi.fn(async () => ({ ok: true }));
    expect((await handleJson(post({ name: "a" }), schema, run, { kind: "data" })).status).toBe(200);
    expect((await handleJson(post({ name: "a" }), schema, run, { kind: "data" })).status).toBe(200);
  });
});

describe("handleJson error handling", () => {
  it("passes a PlannerError's status, message and field errors through", async () => {
    const { handleJson } = await freshHttp();
    // Same module instance as the one http.ts loaded after the reset.
    const { PlannerError } = await import("@/lib/ai");
    const res = await handleJson(post({ name: "a" }), schema, async () => {
      const err = new PlannerError("Pick a later date.", 422) as InstanceType<typeof PlannerError> & {
        fields?: Record<string, string>;
      };
      err.fields = { date: "Too soon" };
      throw err;
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Pick a later date.", fields: { date: "Too soon" } });
  });

  it("hides the details of an unexpected error and logs only its message", async () => {
    const { handleJson } = await freshHttp();
    const res = await handleJson(post({ name: "a" }), schema, async () => {
      throw new Error("database password is hunter2");
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Something went wrong/);
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(console.error).toHaveBeenCalledWith("Planner failure:", "database password is hunter2");
  });

  it("logs 'unknown error' when something other than an Error is thrown", async () => {
    const { handleJson } = await freshHttp();
    const res = await handleJson(post({ name: "a" }), schema, async () => {
      throw "plain string";
    });
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith("Planner failure:", "unknown error");
  });
});
