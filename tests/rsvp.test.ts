import { beforeEach, describe, expect, it } from "vitest";
import { POST as createRoute } from "@/app/api/plans/route";
import { GET as guestsGet, POST as guestsPost } from "@/app/api/plans/[id]/guests/route";
import { GET as rsvpGet, POST as rsvpPost } from "@/app/api/rsvp/[token]/route";
import {
  foodChoices,
  groupChoices,
  guestEvent,
  repliesCsv,
  ReplyInputSchema,
  rsvpMessage,
  suggestedGuests,
  summarize,
  type Reply,
} from "@/lib/rsvp";
import { createMemoryRsvpStore, setRsvpStore } from "@/lib/rsvpStore";
import { createMemoryStore, setStore } from "@/lib/store";
import { baseInput, samplePlan } from "./fixtures";

const reply = (over: Partial<Reply> = {}): Reply => ({
  id: "rabc123",
  name: "Meena",
  phone: "",
  coming: "yes",
  adults: 2,
  kids: 1,
  food: "veg",
  needs: [],
  group: "",
  note: "",
  createdAt: "2026-10-26T06:00:00.000Z",
  updatedAt: "2026-10-26T06:00:00.000Z",
  ...over,
});

describe("reply rules", () => {
  it("accepts a normal reply and clears numbers for a 'no'", () => {
    const ok = ReplyInputSchema.parse({
      name: " Meena ",
      coming: "yes",
      adults: "2",
      kids: "1",
      needs: ["elderly", "x"],
    });
    expect(ok).toMatchObject({ name: "Meena", adults: 2, kids: 1, needs: ["elderly"], food: "any" });
    const no = ReplyInputSchema.parse({ name: "Ravi", coming: "no", adults: 4, needs: ["wheelchair"] });
    expect(no).toMatchObject({ adults: 0, kids: 0, needs: [] });
  });

  it("rejects missing answers, zero people and markup", () => {
    expect(ReplyInputSchema.safeParse({ name: "", coming: "yes" }).success).toBe(false);
    expect(ReplyInputSchema.safeParse({ name: "A", coming: "yes", adults: 0, kids: 0 }).success).toBe(false);
    expect(ReplyInputSchema.safeParse({ name: "A", adults: 1 }).success).toBe(false);
    expect(ReplyInputSchema.safeParse({ name: "<b>A</b>", coming: "yes" }).success).toBe(false);
    expect(ReplyInputSchema.safeParse({ name: "A", coming: "yes", adults: 31 }).success).toBe(false);
  });

  it("offers non-veg only when the menu may have it, and wedding sides for weddings", () => {
    expect(foodChoices("veg")).not.toContain("non-veg");
    expect(foodChoices("veg-and-non-veg")).toContain("non-veg");
    expect(groupChoices("wedding")).toContain("bride");
    expect(groupChoices("birthday")).not.toContain("bride");
  });
});

describe("counts for the host", () => {
  const replies = [
    reply(),
    reply({ id: "r2", coming: "yes", adults: 3, kids: 0, food: "jain", needs: ["wheelchair", "elderly"] }),
    reply({ id: "r3", coming: "maybe", adults: 2, kids: 0, food: "veg" }),
    reply({ id: "r4", coming: "no", adults: 0, kids: 0 }),
  ];

  it("adds up people, food and needs", () => {
    const s = summarize(replies);
    expect(s.coming).toEqual({ families: 2, adults: 5, kids: 1, people: 6 });
    expect(s.maybe).toEqual({ families: 1, people: 2 });
    expect(s.notComing).toBe(1);
    expect(s.expected).toBe(8);
    expect(s.food).toEqual([
      { food: "veg", people: 3, maybe: 2 },
      { food: "jain", people: 3, maybe: 0 },
    ]);
    expect(s.needs).toEqual([
      { need: "elderly", families: 1 },
      { need: "wheelchair", families: 1 },
    ]);
  });

  it("suggests a bigger guest count only when replies clearly need it", () => {
    expect(suggestedGuests(summarize(replies), 40)).toBeNull();
    expect(suggestedGuests(summarize(replies.slice(0, 2)), 2)).toBeNull(); // too few replies
    expect(suggestedGuests(summarize(replies), 2)).toBe(8);
  });

  it("makes a safe spreadsheet file", () => {
    const csv = repliesCsv([reply({ name: "=SUM(A1)", note: 'Says "hi", ok' })]);
    expect(csv.split("\n")[0]).toContain("Name,Phone,Reply");
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain('"Says ""hi"", ok"');
  });

  it("writes the WhatsApp message with the link", () => {
    expect(rsvpMessage("Aarav turns 5", "https://x/r/t")).toContain("https://x/r/t");
    expect(rsvpMessage("A", "L", "Card words")).toMatch(/^Card words\n\n/);
  });
});

describe("guest page content", () => {
  it("shows the invitation but nothing from the plan", () => {
    const event = guestEvent(baseInput, null, true);
    expect(event).toMatchObject({ title: "Aarav turns 5", heading: "You're invited!", open: true, venue: "Bengaluru" });
    expect(JSON.stringify(event)).not.toMatch(/budget|50000|team/i);
  });
});

/* ------------------------------------------------------------------ */

const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
let n = 0;
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/api/x", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": `172.17.0.${++n}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const planCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const tokenCtx = (token: string) => ({ params: Promise.resolve({ token }) });

beforeEach(() => {
  setStore(createMemoryStore());
  setRsvpStore(createMemoryRsvpStore());
});

async function sharedPlan(): Promise<string> {
  const res = await createRoute(
    req("POST", { input: { ...baseInput, date: future }, plan: samplePlan, timings: null, team: [], assignments: {} }),
  );
  return (await res.json()).id;
}

describe("guest replies API", () => {
  it("turns on replies, takes and changes a reply, and closes", async () => {
    const id = await sharedPlan();
    expect(await (await guestsGet(req("GET"), planCtx(id))).json()).toEqual({ link: null, replies: [] });

    const opened = await (await guestsPost(req("POST", { action: "open" }), planCtx(id))).json();
    const token = opened.link.token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(token).not.toBe(id);
    // Opening again keeps the same link.
    expect((await (await guestsPost(req("POST", { action: "open" }), planCtx(id))).json()).link.token).toBe(token);

    const page = await (await rsvpGet(req("GET"), tokenCtx(token))).json();
    expect(page.title).toBe("Aarav turns 5");
    expect(JSON.stringify(page)).not.toContain(id);

    const sent = await rsvpPost(
      req("POST", { reply: { name: "Meena", coming: "yes", adults: 2, kids: 1, food: "veg" } }),
      tokenCtx(token),
    );
    expect(sent.status).toBe(200);
    const { replyId, secret } = await sent.json();

    const changed = await rsvpPost(
      req("POST", { reply: { name: "Meena", coming: "maybe", adults: 2 }, replyId, secret }),
      tokenCtx(token),
    );
    expect(changed.status).toBe(200);
    const wrong = await rsvpPost(
      req("POST", { reply: { name: "X", coming: "no" }, replyId, secret: "A".repeat(22) }),
      tokenCtx(token),
    );
    expect(wrong.status).toBe(403);

    const host = await (await guestsGet(req("GET"), planCtx(id))).json();
    expect(host.replies).toHaveLength(1);
    expect(host.replies[0]).toMatchObject({ name: "Meena", coming: "maybe", adults: 2 });
    expect(host.replies[0]).not.toHaveProperty("secret");

    await guestsPost(req("POST", { action: "close" }), planCtx(id));
    const closed = await rsvpPost(req("POST", { reply: { name: "Late", coming: "yes" } }), tokenCtx(token));
    expect(closed.status).toBe(403);
    expect((await (await rsvpGet(req("GET"), tokenCtx(token))).json()).open).toBe(false);

    const removed = await (
      await guestsPost(req("POST", { action: "remove", replyId: host.replies[0].id }), planCtx(id))
    ).json();
    expect(removed.replies).toEqual([]);
  });

  it("rejects bad replies with field messages, and unknown links", async () => {
    const id = await sharedPlan();
    const { link } = await (await guestsPost(req("POST", { action: "open" }), planCtx(id))).json();
    const bad = await rsvpPost(req("POST", { reply: { name: "", coming: "yes" } }), tokenCtx(link.token));
    expect(bad.status).toBe(400);
    expect((await bad.json()).fields).toHaveProperty("name");

    expect((await rsvpGet(req("GET"), tokenCtx("B".repeat(22)))).status).toBe(404);
    expect((await rsvpGet(req("GET"), tokenCtx("short"))).status).toBe(404);
    expect((await guestsGet(req("GET"), planCtx("C".repeat(22)))).status).toBe(404);
    expect((await guestsPost(req("POST", { action: "open" }), planCtx("C".repeat(22)))).status).toBe(404);
    expect((await guestsPost(req("POST", { action: "explode" }), planCtx(id))).status).toBe(400);
  });
});
