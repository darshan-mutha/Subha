import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Neon = NeonQueryFunction<false, false>;

/** Rows returned by a query, as the Neon driver gives them. */
export type Rows = Awaited<ReturnType<Neon>>;

/** A tagged-template SQL function, e.g. sql`SELECT 1`. */
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Rows>;

/** The database address from the environment, if sharing is set up. */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

/** Runs `task` the first time it is needed and shares that result; after a failure the next call tries again. */
export function once(task: () => Promise<void>): () => Promise<void> {
  let ready: Promise<void> | null = null;
  return () =>
    (ready ??= task().catch((error: unknown) => {
      ready = null;
      throw error;
    }));
}

/**
 * Connects to Neon serverless Postgres. `createTables` runs once, before the
 * first query, so every query can assume its tables exist.
 */
export function connect(url: string, createTables: (sql: Sql) => Promise<void>): Sql {
  const raw: Neon = neon(url);
  const sql: Sql = (strings, ...values) => raw(strings, ...values);
  const ensureTables = once(() => createTables(sql));
  return async (strings, ...values) => {
    await ensureTables();
    return sql(strings, ...values);
  };
}
