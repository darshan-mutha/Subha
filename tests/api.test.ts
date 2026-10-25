import { beforeEach, describe, expect, it, vi } from "vitest";
import { samplePlan } from "./fixtures";
import type * as ExtractLib from "@/lib/extract";

type ExtractModule = typeof ExtractLib;

vi.mock("@/lib/planner", () => ({
  createPlan: vi.fn(async (input) => ({ input, plan: samplePlan, timings: null })),
  refinePlan: vi.fn(async (input) => ({ input, plan: samplePlan, timings: null })),
}));

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

const validBody = {
  eventType: "wedding",
  date: futureDate(90),
  city: "Jaipur",
  guests: 250,
  budget: 1500000,
};

let ip = 0;
function post(path: string, body: unknown, contentType = "application/json") {
  ip++;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": contentType, "x-forwarded-for": `10.0.0.${ip}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/plan", () => {
  let POST: (req: Request) => Promise<Response>;
  beforeEach(async () => {
    ({ POST } = await import("@/app/api/plan/route"));
  });

  it("returns a plan for valid input", async () => {
    const res = await POST(post("/api/plan", validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = await res.json();
    expect(data.plan.summary).toBe(samplePlan.summary);
    expect(data.input.city).toBe("Jaipur");
  });

  it("returns field errors for invalid input", async () => {
    const res = await POST(post("/api/plan", { ...validBody, guests: 0, city: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(Object.keys(data.fields)).toEqual(expect.arrayContaining(["guests", "city"]));
  });

  it("rejects non-JSON requests", async () => {
    expect((await POST(post("/api/plan", "x", "text/plain"))).status).toBe(415);
    expect((await POST(post("/api/plan", "{bad json"))).status).toBe(400);
  });

  it("rejects oversized requests", async () => {
    const res = await POST(post("/api/plan", { ...validBody, notes: "a".repeat(40_000) }));
    expect(res.status).toBe(413);
  });

  it("rate limits repeated requests from one address", async () => {
    const make = () =>
      new Request("http://localhost/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
        body: JSON.stringify(validBody),
      });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await POST(make())).status);
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe("POST /api/refine", () => {
  it("requires a change request", async () => {
    const { POST } = await import("@/app/api/refine/route");
    const res = await POST(post("/api/refine", { input: validBody, plan: samplePlan, instruction: "" }));
    expect(res.status).toBe(400);
    const ok = await POST(
      post("/api/refine", { input: validBody, plan: samplePlan, instruction: "Make it eco-friendly" }),
    );
    expect(ok.status).toBe(200);
  });
});

describe("POST /api/extract", () => {
  it("accepts a voice note larger than the normal body limit", async () => {
    vi.doMock("@/lib/extract", async (orig) => ({
      ...(await orig<ExtractModule>()),
      extractEventDetails: vi.fn(async () => ({ transcript: "hi", values: {}, missing: [] })),
    }));
    const { POST } = await import("@/app/api/extract/route");
    const res = await POST(post("/api/extract", { audio: { mimeType: "audio/webm", data: "A".repeat(100_000) } }));
    expect(res.status).toBe(200);
    const bad = await POST(post("/api/extract", { text: "hi" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).fields.text).toMatch(/a little more/);
  });
});
