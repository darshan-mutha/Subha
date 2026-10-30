import { randomBytes } from "node:crypto";
import { connect, databaseUrl, type Rows, type Sql } from "./db";
import { HttpError, PLAN_NOT_FOUND } from "./errors";
import { PlanSchema, withInputDefaults } from "./schemas";
import { planItems, pruneState, type Done, type SharedPlan, type SharedPlanContent } from "./team";

/**
 * Storage for shared plans. The app talks to this interface only, so the
 * database can be swapped (and tests use the in-memory version).
 */
export interface PlanStore {
  create(content: SharedPlanContent, done?: Done): Promise<SharedPlan>;
  get(id: string): Promise<SharedPlan | null>;
  /** Whether a plan with this id is stored, without loading it. */
  exists(id: string): Promise<boolean>;
  /** Replaces the plan content. Fails with 409 if someone else saved first. */
  update(id: string, content: SharedPlanContent, expectedVersion: number): Promise<SharedPlan>;
  /** Ticks or unticks one item. Safe when several people tick at once. */
  setDone(id: string, itemId: string, done: boolean): Promise<SharedPlan | null>;
}

/** A new random, unguessable id for a shared plan link. */
export function newShareId(): string {
  return randomBytes(16).toString("base64url");
}

const conflict = () =>
  new HttpError("Someone else just updated this plan. We've loaded the latest version; please try again.", 409);
const notFound = () => new HttpError(PLAN_NOT_FOUND, 404);

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
    async exists(id) {
      return rows.has(id);
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

/** Plans saved by older versions of Shubā are read into today's shape. */
export function upgradeContent(content: SharedPlanContent): SharedPlanContent {
  const plan = PlanSchema.safeParse(content.plan);
  return {
    ...content,
    input: withInputDefaults(content.input),
    plan: plan.success ? plan.data : content.plan,
  };
}

function toPlan(row: Row): SharedPlan {
  return {
    ...upgradeContent(row.content),
    id: row.id,
    version: row.version,
    done: row.done ?? {},
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const createPlansTable = async (sql: Sql) => {
  await sql`
    CREATE TABLE IF NOT EXISTS shuba_plans (
      id          text PRIMARY KEY,
      content     jsonb NOT NULL,
      done        jsonb NOT NULL DEFAULT '{}'::jsonb,
      version     integer NOT NULL DEFAULT 1,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )`;
};

const firstPlan = (rows: Rows): SharedPlan | null => (rows[0] ? toPlan(rows[0] as Row) : null);

/**
 * Saves new content only if the plan is still at `expectedVersion`, keeping
 * ticks for items that are still in the plan. Returns null if nothing changed.
 */
async function updateIfCurrent(sql: Sql, id: string, content: SharedPlanContent, expectedVersion: number) {
  const itemIds = planItems(content.plan).map((item) => item.id);
  return firstPlan(
    await sql`
      UPDATE shuba_plans
         SET content = ${JSON.stringify(content)}::jsonb,
             done = COALESCE(
               (SELECT jsonb_object_agg(key, value) FROM jsonb_each(shuba_plans.done) WHERE key = ANY(${itemIds}::text[])),
               '{}'::jsonb),
             version = version + 1,
             updated_at = now()
       WHERE id = ${id} AND version = ${expectedVersion}
      RETURNING id, content, done, version, updated_at`,
  );
}

/** Neon serverless Postgres. The table is created automatically on first use. */
export function createNeonStore(url: string): PlanStore {
  const sql = connect(url, createPlansTable);
  return {
    async create(content, done = {}) {
      const created = firstPlan(
        await sql`
          INSERT INTO shuba_plans (id, content, done)
          VALUES (${newShareId()}, ${JSON.stringify(content)}::jsonb, ${JSON.stringify(done)}::jsonb)
          RETURNING id, content, done, version, updated_at`,
      );
      if (!created) throw new Error("The new plan was not returned by the database.");
      return created;
    },
    async get(id) {
      return firstPlan(await sql`SELECT id, content, done, version, updated_at FROM shuba_plans WHERE id = ${id}`);
    },
    async exists(id) {
      return Boolean((await sql`SELECT 1 FROM shuba_plans WHERE id = ${id}`)[0]);
    },
    async update(id, content, expectedVersion) {
      const updated = await updateIfCurrent(sql, id, content, expectedVersion);
      if (updated) return updated;
      // Nothing was saved: either the plan is gone or someone else saved first.
      const exists = await sql`SELECT 1 FROM shuba_plans WHERE id = ${id}`;
      throw exists[0] ? conflict() : notFound();
    },
    async setDone(id, itemId, done) {
      return firstPlan(
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
  const url = databaseUrl();
  if (!url) throw new HttpError("Sharing is not set up yet. You can still download or print your plan.", 503);
  store = createNeonStore(url);
  return store;
}

/** For tests. */
export function setStore(next: PlanStore | null): void {
  store = next;
}
