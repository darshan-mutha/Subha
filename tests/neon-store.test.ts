import { beforeEach, describe, expect, it, vi } from "vitest";
import { planItems } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

/** Fake tagged-template SQL client: records queries and values, returns queued rows. */
const queries: string[] = [];
const values: unknown[][] = [];
const replies: unknown[][] = [];
vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    (strings: TemplateStringsArray, ...params: unknown[]) => {
      queries.push(strings.join("?").replace(/\s+/g, " ").trim());
      values.push(params);
      return Promise.resolve(replies.shift() ?? []);
    },
}));

const { createNeonStore, getStore, setStore } = await import("@/lib/store");

const content = { input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {} };
const row = (over: object = {}) => ({
  id: "abc",
  content,
  done: {},
  version: 1,
  updated_at: "2026-10-24T00:00:00Z",
  ...over,
});

beforeEach(() => {
  queries.length = 0;
  values.length = 0;
  replies.length = 0;
});

describe("Neon plan store", () => {
  it("creates the table once, then inserts", async () => {
    const store = createNeonStore("postgres://test");
    replies.push([], [row()]);
    const created = await store.create(content);
    expect(created).toMatchObject({ id: "abc", version: 1, updatedAt: "2026-10-24T00:00:00.000Z" });
    replies.push([row()]);
    await store.get("abc");
    expect(queries.filter((q) => q.startsWith("CREATE TABLE"))).toHaveLength(1);
    expect(queries[1]).toMatch(/^INSERT INTO shuba_plans/);
  });

  it("returns null for an unknown plan", async () => {
    const store = createNeonStore("postgres://test");
    replies.push([], []);
    expect(await store.get("missing")).toBeNull();
  });

  it("updates in one query with a version check and keeps only ticks for items still in the plan", async () => {
    const store = createNeonStore("postgres://test");
    replies.push([], [row({ version: 2 })]);
    const updated = await store.update("abc", content, 1);
    expect(updated.version).toBe(2);
    expect(queries).toHaveLength(2);
    expect(queries[1]).toMatch(/^UPDATE shuba_plans/);
    expect(queries[1]).toMatch(/jsonb_each\(shuba_plans\.done\) WHERE key = ANY/);
    expect(queries[1]).toMatch(/WHERE id = \? AND version = \?/);
    expect(values[1]).toContainEqual(planItems(samplePlan).map((item) => item.id));
  });

  it("tells a version conflict apart from a missing plan only when nothing was saved", async () => {
    const store = createNeonStore("postgres://test");
    replies.push([], [], [{ "?column?": 1 }]);
    await expect(store.update("abc", content, 1)).rejects.toMatchObject({ status: 409 });
    expect(queries.at(-1)).toMatch(/^SELECT 1 FROM shuba_plans WHERE id = \?/);
    replies.push([], []);
    await expect(store.update("abc", content, 1)).rejects.toMatchObject({
      status: 404,
      message: "This plan could not be found. The link may be wrong.",
    });
  });

  it("ticks items atomically in the database", async () => {
    const store = createNeonStore("postgres://test");
    replies.push([], [row({ done: { t_1: true } })]);
    const result = await store.setDone("abc", "t_1", true);
    expect(result?.done).toEqual({ t_1: true });
    expect(queries.at(-1)).toMatch(/done = done \|\| jsonb_build_object/);
  });

  it("uses DATABASE_URL when it is set", () => {
    setStore(null);
    process.env.DATABASE_URL = "postgres://configured";
    expect(getStore()).toBe(getStore());
    delete process.env.DATABASE_URL;
    setStore(null);
  });
});
