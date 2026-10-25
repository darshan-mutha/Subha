import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { PlannerError } from "./gemini";
import { pruneState, type Done, type SharedPlan, type SharedPlanContent } from "./team";

/**
 * Storage for shared plans. The app talks to this interface only, so the
 * database can be swapped (and tests use the in-memory version).
 */
export interface PlanStore {
  create(content: SharedPlanContent, done?: Done): Promise<SharedPlan>;
  get(id: string): Promise<SharedPlan | null>;
  /** Replaces the plan content. Fails with 409 if someone else saved first. */
  update(id: string, content: SharedPlanContent, expectedVersion: number): Promise<SharedPlan>;
  /** Ticks or unticks one item. Safe when several people tick at once. */
  setDone(id: string, itemId: string, done: boolean): Promise<SharedPlan | null>;
}

export function newShareId(): string {
  return randomBytes(16).toString("base64url");
}

const conflict = () =>
  new PlannerError("Someone else just updated this plan. We've loaded the latest version; please try again.", 409);
const notFound = () => new PlannerError("This plan could not be found. The link may be wrong.", 404);

/* ------------------------------------------------------------------ */

export function createMemoryStore(): PlanStore {
  const rows = new Map<string, SharedPlan>();
  const now = () => new Date().toISOString();
  return {
    async create(content, done = {}) {
      const plan: SharedPlan = { ...content, id: newShareId(), version: 1, done, updatedAt: now() };
      rows.set(plan.id, plan);
      return structuredClone(plan);
    },
    async get(id) {
      const row = rows.get(id);
      return row ? structuredClone(row) : null;
    },
    async update(id, content, expectedVersion) {
      const row = rows.get(id);
      if (!row) throw notFound();
      if (row.version !== expectedVersion) throw conflict();
      const pruned = pruneState(content.plan, content.team, content.assignments, row.done);
      const next: SharedPlan = { ...row, ...content, ...pruned, version: row.version + 1, updatedAt: now() };
      rows.set(id, next);
      return structuredClone(next);
    },
    async setDone(id, itemId, done) {
      const row = rows.get(id);
      if (!row) return null;
      row.done = { ...row.done, [itemId]: done };
      row.updatedAt = now();
      return structuredClone(row);
    },
  };
}

/* ------------------------------------------------------------------ */

interface Row {
  id: string;
  content: SharedPlanContent;
  done: Done;
  version: number;
  updated_at: string | Date;
}

function toPlan(row: Row): SharedPlan {
  return {
    ...row.content,
    id: row.id,
    version: row.version,
    done: row.done ?? {},
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Neon serverless Postgres. The table is created automatically on first use. */
export function createNeonStore(databaseUrl: string): PlanStore {
  const sql = neon(databaseUrl);
  let ready: Promise<unknown> | null = null;
  const ensureTable = () =>
    (ready ??= sql`
      CREATE TABLE IF NOT EXISTS shuba_plans (
        id          text PRIMARY KEY,
        content     jsonb NOT NULL,
        done        jsonb NOT NULL DEFAULT '{}'::jsonb,
        version     integer NOT NULL DEFAULT 1,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now()
      )`.catch((error) => {
      ready = null;
      throw error;
    }));

  const one = (rows: unknown[]) => (rows[0] ? toPlan(rows[0] as Row) : null);

  return {
    async create(content, done = {}) {
      await ensureTable();
      const rows = await sql`
        INSERT INTO shuba_plans (id, content, done)
        VALUES (${newShareId()}, ${JSON.stringify(content)}::jsonb, ${JSON.stringify(done)}::jsonb)
        RETURNING id, content, done, version, updated_at`;
      return one(rows)!;
    },
    async get(id) {
      await ensureTable();
      return one(await sql`SELECT id, content, done, version, updated_at FROM shuba_plans WHERE id = ${id}`);
    },
    async update(id, content, expectedVersion) {
      await ensureTable();
      const current = await this.get(id);
      if (!current) throw notFound();
      if (current.version !== expectedVersion) throw conflict();
      const { done } = pruneState(content.plan, content.team, content.assignments, current.done);
      const rows = await sql`
        UPDATE shuba_plans
           SET content = ${JSON.stringify(content)}::jsonb,
               done = ${JSON.stringify(done)}::jsonb,
               version = version + 1,
               updated_at = now()
         WHERE id = ${id} AND version = ${expectedVersion}
        RETURNING id, content, done, version, updated_at`;
      const updated = one(rows);
      if (!updated) throw conflict();
      return updated;
    },
    async setDone(id, itemId, done) {
      await ensureTable();
      return one(
        await sql`
        UPDATE shuba_plans
           SET done = done || jsonb_build_object(${itemId}::text, ${done}::boolean),
               updated_at = now()
         WHERE id = ${id}
        RETURNING id, content, done, version, updated_at`,
      );
    },
  };
}

/* ------------------------------------------------------------------ */

let store: PlanStore | null = null;

/** Returns the configured store, or throws a friendly 503 if sharing is not set up. */
export function getStore(): PlanStore {
  if (store) return store;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new PlannerError("Sharing is not set up yet. You can still download or print your plan.", 503);
  store = createNeonStore(url);
  return store;
}

/** For tests. */
export function setStore(next: PlanStore | null): void {
  store = next;
}
