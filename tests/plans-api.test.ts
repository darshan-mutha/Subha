import { beforeEach, describe, expect, it } from "vitest";
import { POST as createRoute } from "@/app/api/plans/route";
import { GET, PUT } from "@/app/api/plans/[id]/route";
import { POST as progressRoute } from "@/app/api/plans/[id]/progress/route";
import { createMemoryStore, setStore } from "@/lib/store";
import { planItems } from "@/lib/team";
import { samplePlan } from "./fixtures";

const input = {
  eventType: "birthday",
  eventName: "Aarav turns 5",
  date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  city: "Bengaluru",
  guests: 40,
  budget: 50000,
};
const content = {
  input,
  plan: samplePlan,
  timings: null,
  team: [{ id: "mravi", name: "Ravi", role: "" }],
  assignments: {},
};

let n = 0;
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/api/plans", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": `172.16.0.${++n}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => setStore(createMemoryStore()));

describe("shared plan API", () => {
  it("creates a plan, loads it, ticks a task and updates it", async () => {
    const [item] = planItems(samplePlan);
    const created = await createRoute(req("POST", { ...content, done: { [item.id]: true } }));
    expect(created.status).toBe(200);
    const { id } = await created.json();
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const loaded = await (await GET(req("GET"), ctx(id))).json();
    expect(loaded.done[item.id]).toBe(true);
    expect(loaded.team[0].name).toBe("Ravi");

    const ticked = await progressRoute(req("POST", { itemId: item.id, done: false }), ctx(id));
    expect((await ticked.json()).done[item.id]).toBe(false);

    const put = await PUT(req("PUT", { version: 1, content: { ...content, team: [] } }), ctx(id));
    expect(put.status).toBe(200);
    expect((await put.json()).version).toBe(2);

    const stale = await PUT(req("PUT", { version: 1, content }), ctx(id));
    expect(stale.status).toBe(409);
  });

  it("returns 404 for malformed or unknown links", async () => {
    expect((await GET(req("GET"), ctx("../../etc/passwd"))).status).toBe(404);
    expect((await GET(req("GET"), ctx("A".repeat(22)))).status).toBe(404);
    expect((await progressRoute(req("POST", { itemId: "t_abc", done: true }), ctx("A".repeat(22)))).status).toBe(404);
  });

  it("rejects bad progress updates", async () => {
    const { id } = await (await createRoute(req("POST", content))).json();
    const res = await progressRoute(req("POST", { itemId: "drop table", done: "yes" }), ctx(id));
    expect(res.status).toBe(400);
  });

  it("explains when sharing is not set up", async () => {
    setStore(null);
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    const res = await createRoute(req("POST", content));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not set up/);
    if (prev) process.env.DATABASE_URL = prev;
  });
});

describe("POST /api/assign", () => {
  it("validates the team before calling the AI", async () => {
    const { POST } = await import("@/app/api/assign/route");
    const res = await POST(req("POST", { input, plan: samplePlan, team: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).fields.team).toMatch(/at least one person/);
  });
});
