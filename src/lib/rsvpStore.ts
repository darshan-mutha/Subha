import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { connect, databaseUrl, type Rows, type Sql } from "./db";
import { HttpError } from "./errors";
import { MAX_REPLIES, type Reply, type ReplyInput } from "./rsvp";

/**
 * Storage for guest links and replies. A guest link is its own random token,
 * separate from the team link, so a guest can never open or change the plan.
 * Each reply gets a secret kept on the guest's phone, so only they can change it.
 */
export interface GuestLink {
  token: string;
  planId: string;
  open: boolean;
}

export interface RsvpStore {
  /** Returns the plan's guest link, creating it the first time. */
  openLink(planId: string): Promise<GuestLink>;
  getLinkForPlan(planId: string): Promise<GuestLink | null>;
  getLink(token: string): Promise<GuestLink | null>;
  setOpen(planId: string, open: boolean): Promise<GuestLink | null>;
  /** Adds a reply, or changes one when the id and secret match. */
  saveReply(
    planId: string,
    reply: ReplyInput,
    replyId?: string,
    secret?: string,
  ): Promise<{ id: string; secret: string }>;
  listReplies(planId: string): Promise<Reply[]>;
  removeReply(planId: string, replyId: string): Promise<void>;
}

const token = () => randomBytes(16).toString("base64url");
const replyId = () => `r${randomBytes(6).toString("hex")}`;
const hash = (secret: string) => createHash("sha256").update(secret).digest("hex");
function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const tooMany = () => new HttpError("This event has reached the limit for replies. Please contact the hosts.", 409);
const notYours = () => new HttpError("This reply could not be changed from this phone. Please send a new reply.", 403);

/* ------------------------------------------------------------------ */

export function createMemoryRsvpStore(): RsvpStore {
  const links = new Map<string, GuestLink>();
  const replies = new Map<string, { planId: string; secretHash: string; reply: Reply }>();
  const byPlan = (planId: string) => [...links.values()].find((l) => l.planId === planId) ?? null;
  return {
    async openLink(planId) {
      const existing = byPlan(planId);
      if (existing) return { ...existing };
      const link = { token: token(), planId, open: true };
      links.set(link.token, link);
      return { ...link };
    },
    async getLinkForPlan(planId) {
      const link = byPlan(planId);
      return link ? { ...link } : null;
    },
    async getLink(t) {
      const link = links.get(t);
      return link ? { ...link } : null;
    },
    async setOpen(planId, open) {
      const link = byPlan(planId);
      if (!link) return null;
      link.open = open;
      return { ...link };
    },
    async saveReply(planId, input, id, secret) {
      const now = new Date().toISOString();
      if (id && secret) {
        const row = replies.get(id);
        if (!row || row.planId !== planId || !sameHash(row.secretHash, hash(secret))) throw notYours();
        row.reply = { ...input, id, createdAt: row.reply.createdAt, updatedAt: now };
        return { id, secret };
      }
      const count = [...replies.values()].filter((r) => r.planId === planId).length;
      if (count >= MAX_REPLIES) throw tooMany();
      const newId = replyId();
      const newSecret = token();
      replies.set(newId, {
        planId,
        secretHash: hash(newSecret),
        reply: { ...input, id: newId, createdAt: now, updatedAt: now },
      });
      return { id: newId, secret: newSecret };
    },
    async listReplies(planId) {
      return [...replies.values()]
        .filter((r) => r.planId === planId)
        .map((r) => structuredClone(r.reply))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async removeReply(planId, id) {
      if (replies.get(id)?.planId === planId) replies.delete(id);
    },
  };
}

/* ------------------------------------------------------------------ */

interface ReplyRow {
  id: string;
  data: ReplyInput;
  created_at: string | Date;
  updated_at: string | Date;
}

const toReply = (row: ReplyRow): Reply => ({
  ...row.data,
  id: row.id,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const toLink = (rows: Rows): GuestLink | null => {
  const r = rows[0] as { token: string; plan_id: string; open: boolean } | undefined;
  return r ? { token: r.token, planId: r.plan_id, open: r.open } : null;
};

const createRsvpTables = async (sql: Sql) => {
  await sql`
    CREATE TABLE IF NOT EXISTS shuba_guest_links (
      token       text PRIMARY KEY,
      plan_id     text NOT NULL UNIQUE,
      open        boolean NOT NULL DEFAULT true,
      created_at  timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS shuba_replies (
      id           text PRIMARY KEY,
      plan_id      text NOT NULL,
      secret_hash  text NOT NULL,
      data         jsonb NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS shuba_replies_plan ON shuba_replies (plan_id)`;
};

/** Adds a new reply unless the event already has the most replies allowed, in one statement. */
async function insertReply(sql: Sql, planId: string, input: ReplyInput) {
  const newId = replyId();
  const newSecret = token();
  const rows = await sql`
    INSERT INTO shuba_replies (id, plan_id, secret_hash, data)
    SELECT ${newId}, ${planId}, ${hash(newSecret)}, ${JSON.stringify(input)}::jsonb
     WHERE (SELECT count(*) FROM shuba_replies WHERE plan_id = ${planId}) < ${MAX_REPLIES}
    RETURNING id`;
  if (!rows[0]) throw tooMany();
  return { id: newId, secret: newSecret };
}

/** Neon serverless Postgres. Tables are created automatically on first use. */
export function createNeonRsvpStore(url: string): RsvpStore {
  const sql = connect(url, createRsvpTables);
  const getLinkForPlan = async (planId: string) =>
    toLink(await sql`SELECT token, plan_id, open FROM shuba_guest_links WHERE plan_id = ${planId}`);
  return {
    async openLink(planId) {
      const rows = await sql`
        INSERT INTO shuba_guest_links (token, plan_id) VALUES (${token()}, ${planId})
        ON CONFLICT (plan_id) DO NOTHING
        RETURNING token, plan_id, open`;
      const link = toLink(rows) ?? (await getLinkForPlan(planId));
      if (!link) throw new Error("The guest link was not saved.");
      return link;
    },
    getLinkForPlan,
    async getLink(t) {
      return toLink(await sql`SELECT token, plan_id, open FROM shuba_guest_links WHERE token = ${t}`);
    },
    async setOpen(planId, open) {
      return toLink(
        await sql`UPDATE shuba_guest_links SET open = ${open} WHERE plan_id = ${planId} RETURNING token, plan_id, open`,
      );
    },
    async saveReply(planId, input, id, secret) {
      if (!id || !secret) return insertReply(sql, planId, input);
      const rows = await sql`
        UPDATE shuba_replies SET data = ${JSON.stringify(input)}::jsonb, updated_at = now()
         WHERE id = ${id} AND plan_id = ${planId} AND secret_hash = ${hash(secret)}
        RETURNING id`;
      if (!rows[0]) throw notYours();
      return { id, secret };
    },
    async listReplies(planId) {
      const rows = await sql`
        SELECT id, data, created_at, updated_at FROM shuba_replies
         WHERE plan_id = ${planId} ORDER BY updated_at DESC LIMIT ${MAX_REPLIES}`;
      return (rows as ReplyRow[]).map(toReply);
    },
    async removeReply(planId, id) {
      await sql`DELETE FROM shuba_replies WHERE id = ${id} AND plan_id = ${planId}`;
    },
  };
}

/* ------------------------------------------------------------------ */

let rsvpStore: RsvpStore | null = null;

/** Returns the configured reply store, or throws a friendly 503 if it is not set up. */
export function getRsvpStore(): RsvpStore {
  if (rsvpStore) return rsvpStore;
  const url = databaseUrl();
  if (!url) throw new HttpError("Guest replies are not set up yet.", 503);
  rsvpStore = createNeonRsvpStore(url);
  return rsvpStore;
}

/** For tests. */
export function setRsvpStore(next: RsvpStore | null): void {
  rsvpStore = next;
}
