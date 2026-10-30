import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReplyInput } from "@/lib/rsvp";

/** Fake tagged-template SQL client: records queries and values, returns queued rows. */
const queries: { text: string; values: unknown[] }[] = [];
const rows: unknown[][] = [];
vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
      return Promise.resolve(rows.shift() ?? []);
    },
}));

const { createMemoryRsvpStore, createNeonRsvpStore, getRsvpStore, setRsvpStore } = await import("@/lib/rsvpStore");

const input: ReplyInput = {
  name: "Meena",
  phone: "",
  coming: "yes",
  adults: 2,
  kids: 0,
  food: "veg",
  needs: [],
  group: "",
  note: "",
};
const SETUP = 3; // two tables and an index

beforeEach(() => {
  queries.length = 0;
  rows.length = 0;
});

describe("Neon guest reply store", () => {
  it("creates tables once, makes one link per plan and reads it back", async () => {
    const store = createNeonRsvpStore("postgres://test");
    rows.push([], [], [], [], [{ token: "T".repeat(22), plan_id: "plan", open: true }]);
    const link = await store.openLink("plan");
    expect(link).toEqual({ token: "T".repeat(22), planId: "plan", open: true });
    expect(queries[SETUP].text).toContain("ON CONFLICT (plan_id) DO NOTHING");
    rows.push([{ token: "T".repeat(22), plan_id: "plan", open: false }]);
    expect((await store.setOpen("plan", false))?.open).toBe(false);
    rows.push([]);
    expect(await store.getLink("missing")).toBeNull();
    expect(queries.filter((q) => q.text.startsWith("CREATE TABLE"))).toHaveLength(2);
  });

  it("stores only a hash of the guest's secret and checks it when changing a reply", async () => {
    const store = createNeonRsvpStore("postgres://test");
    rows.push([], [], [], [{ id: "r1" }]);
    const { id, secret } = await store.saveReply("plan", input);
    const insert = queries.find((q) => q.text.startsWith("INSERT INTO shuba_replies"))!;
    expect(insert.values).not.toContain(secret);
    expect(insert.values[2]).toMatch(/^[a-f0-9]{64}$/);

    rows.push([{ id }]);
    await expect(store.saveReply("plan", input, id, secret)).resolves.toEqual({ id, secret });
    rows.push([]);
    await expect(store.saveReply("plan", input, id, "W".repeat(22))).rejects.toMatchObject({ status: 403 });
  });

  it("stops at the reply limit, lists and removes", async () => {
    const store = createNeonRsvpStore("postgres://test");
    rows.push([], [], [], []);
    await expect(store.saveReply("plan", input)).rejects.toMatchObject({ status: 409 });
    const insert = queries.at(-1);
    expect(insert?.text).toMatch(
      /^INSERT INTO shuba_replies .* SELECT .* WHERE \(SELECT count\(\*\) FROM shuba_replies WHERE plan_id = \?\) < \?/,
    );
    expect(insert?.values.at(-1)).toBe(3000);
    rows.push([{ id: "r1", data: input, created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T01:00:00Z" }]);
    expect(await store.listReplies("plan")).toEqual([
      { ...input, id: "r1", createdAt: "2026-10-26T00:00:00.000Z", updatedAt: "2026-10-26T01:00:00.000Z" },
    ]);
    await store.removeReply("plan", "r1");
    expect(queries.at(-1)?.text).toContain("DELETE FROM shuba_replies WHERE id = ? AND plan_id = ?");
  });
});

describe("memory store and setup", () => {
  it("only lets the guest with the secret change a reply, and removes only within the plan", async () => {
    const store = createMemoryRsvpStore();
    const saved = await store.saveReply("a", input);
    await expect(store.saveReply("b", input, saved.id, saved.secret)).rejects.toMatchObject({ status: 403 });
    await store.removeReply("b", saved.id);
    expect(await store.listReplies("a")).toHaveLength(1);
    expect(await store.setOpen("none", false)).toBeNull();
    expect(await store.getLinkForPlan("none")).toBeNull();
  });

  it("explains when the database is not set up", () => {
    setRsvpStore(null);
    const url = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    expect(() => getRsvpStore()).toThrow(/not set up/);
    process.env.DATABASE_URL = "postgres://test";
    expect(getRsvpStore()).toBe(getRsvpStore());
    setRsvpStore(null);
    if (url) process.env.DATABASE_URL = url;
    else delete process.env.DATABASE_URL;
  });
});
