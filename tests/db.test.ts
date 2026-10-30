import { beforeEach, describe, expect, it, vi } from "vitest";

const queries: string[] = [];
vi.mock("@neondatabase/serverless", () => ({
  neon: () => (strings: TemplateStringsArray) => {
    queries.push(strings.join("?"));
    return Promise.resolve([]);
  },
}));

const { connect, databaseUrl, once } = await import("@/lib/db");

beforeEach(() => {
  queries.length = 0;
});

describe("once", () => {
  it("runs the task a single time while it succeeds", async () => {
    const task = vi.fn(async () => undefined);
    const run = once(task);
    await Promise.all([run(), run()]);
    await run();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failure", async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const run = once(task);
    await expect(run()).rejects.toThrow("offline");
    await run();
    await run();
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe("connect", () => {
  it("creates the tables once, before the first query", async () => {
    const sql = connect("postgres://test", async (raw) => {
      await raw`CREATE TABLE t`;
    });
    await sql`SELECT 1`;
    await sql`SELECT 2`;
    expect(queries).toEqual(["CREATE TABLE t", "SELECT 1", "SELECT 2"]);
  });
});

describe("databaseUrl", () => {
  it("prefers DATABASE_URL and falls back to POSTGRES_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("POSTGRES_URL", "postgres://fallback");
    expect(databaseUrl()).toBe("postgres://fallback");
    vi.stubEnv("DATABASE_URL", "postgres://main");
    expect(databaseUrl()).toBe("postgres://main");
    vi.unstubAllEnvs();
  });
});
