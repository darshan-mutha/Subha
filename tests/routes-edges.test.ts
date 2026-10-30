import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createRoute } from "@/app/api/plans/route";
import { GET as planGet, PUT as planPut } from "@/app/api/plans/[id]/route";
import { GET as guestsGet, POST as guestsPost } from "@/app/api/plans/[id]/guests/route";
import { GET as rsvpGet, POST as rsvpPost } from "@/app/api/rsvp/[token]/route";
import { PlannerError } from "@/lib/ai";
import { createMemoryRsvpStore, setRsvpStore } from "@/lib/rsvpStore";
import type { RsvpStore } from "@/lib/rsvpStore";
import { createMemoryStore, setStore } from "@/lib/store";
import type { PlanStore } from "@/lib/store";
import { baseInput, samplePlan } from "./fixtures";

const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
const VALID_ID = "A".repeat(22);

let n = 0;
const req = (method: string, body?: unknown) =>
  new Request("http://localhost/api/x", {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": `172.18.0.${++n}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const planCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const tokenCtx = (token: string) => ({ params: Promise.resolve({ token }) });

/** A plan store whose reads fail with the given error. */
function failingPlanStore(error: unknown): PlanStore {
  const fail = async () => {
    throw error;
  };
  return { create: fail, get: fail, update: fail, setDone: fail };
}

/** A guest-reply store whose link lookups fail with the given error. */
function failingRsvpStore(error: unknown): RsvpStore {
  return {
    ...createMemoryRsvpStore(),
    getLink: async () => {
      throw error;
    },
    getLinkForPlan: async () => {
      throw error;
    },
  };
}

async function sharedPlan(): Promise<string> {
  const res = await createRoute(
    req("POST", { input: { ...baseInput, date: future }, plan: samplePlan, timings: null, team: [], assignments: {} }),
  );
  return (await res.json()).id;
}

beforeEach(() => {
  setStore(createMemoryStore());
  setRsvpStore(createMemoryRsvpStore());
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET and PUT /api/plans/[id] failures", () => {
  it("passes a store's PlannerError status through on load", async () => {
    setStore(failingPlanStore(new PlannerError("Sharing is not set up yet.", 503)));
    const res = await planGet(req("GET"), planCtx(VALID_ID));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Sharing is not set up yet.");
  });

  it("hides unexpected load errors behind a plain 500", async () => {
    setStore(failingPlanStore(new Error("connection refused")));
    const res = await planGet(req("GET"), planCtx(VALID_ID));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Could not load the plan. Please try again.");
    expect(console.error).toHaveBeenCalledWith("Load failure:", "connection refused");
  });

  it("logs 'unknown error' when the store throws something that is not an Error", async () => {
    setStore(failingPlanStore("weird"));
    expect((await planGet(req("GET"), planCtx(VALID_ID))).status).toBe(500);
    expect(console.error).toHaveBeenCalledWith("Load failure:", "unknown error");
  });

  it("refuses to save to a malformed plan id", async () => {
    const res = await planPut(req("PUT", { version: 1, content: {} }), planCtx("not/a/real/id"));
    expect(res.status).toBe(404);
  });
});

describe("/api/plans/[id]/guests failures", () => {
  it("returns 404 for a malformed plan id without touching the store", async () => {
    setStore(failingPlanStore(new Error("should not be called")));
    expect((await guestsGet(req("GET"), planCtx("../x"))).status).toBe(404);
  });

  it("passes a PlannerError from the reply store through", async () => {
    const id = await sharedPlan();
    setRsvpStore(failingRsvpStore(new PlannerError("Guest replies are not set up yet.", 503)));
    const res = await guestsGet(req("GET"), planCtx(id));
    expect(res.status).toBe(503);
  });

  it("hides unexpected errors behind a plain 500", async () => {
    const id = await sharedPlan();
    setRsvpStore(failingRsvpStore(new Error("db down")));
    const res = await guestsGet(req("GET"), planCtx(id));
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith("Guests load failure:", "db down");
  });

  it("logs 'unknown error' for non-Error failures", async () => {
    const id = await sharedPlan();
    setRsvpStore(failingRsvpStore(42));
    expect((await guestsGet(req("GET"), planCtx(id))).status).toBe(500);
    expect(console.error).toHaveBeenCalledWith("Guests load failure:", "unknown error");
  });

  it("reopens a closed guest link with the same token", async () => {
    const id = await sharedPlan();
    const first = await (await guestsPost(req("POST", { action: "open" }), planCtx(id))).json();
    await guestsPost(req("POST", { action: "close" }), planCtx(id));
    const reopened = await (await guestsPost(req("POST", { action: "open" }), planCtx(id))).json();
    expect(reopened.link).toEqual({ token: first.link.token, open: true });
  });
});

describe("/api/rsvp/[token] failures", () => {
  it("shows not found when the link's plan has been removed", async () => {
    const rsvp = createMemoryRsvpStore();
    const link = await rsvp.openLink(VALID_ID); // a link for a plan that is not in the plan store
    setRsvpStore(rsvp);
    expect((await rsvpGet(req("GET"), tokenCtx(link.token))).status).toBe(404);
    const posted = await rsvpPost(req("POST", { reply: { name: "Meena", coming: "yes" } }), tokenCtx(link.token));
    expect(posted.status).toBe(404);
  });

  it("returns 404 for a reply sent to a malformed token", async () => {
    const res = await rsvpPost(req("POST", { reply: { name: "Meena", coming: "yes" } }), tokenCtx("bad"));
    expect(res.status).toBe(404);
  });

  it("passes a PlannerError through when loading the invitation", async () => {
    setRsvpStore(failingRsvpStore(new PlannerError("Guest replies are not set up yet.", 503)));
    const res = await rsvpGet(req("GET"), tokenCtx(VALID_ID));
    expect(res.status).toBe(503);
  });

  it("hides unexpected errors when loading the invitation", async () => {
    setRsvpStore(failingRsvpStore(new Error("timeout")));
    const res = await rsvpGet(req("GET"), tokenCtx(VALID_ID));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Could not load the invitation. Please try again.");
    expect(console.error).toHaveBeenCalledWith("RSVP load failure:", "timeout");
  });

  it("logs 'unknown error' for non-Error failures when loading the invitation", async () => {
    setRsvpStore(failingRsvpStore(null));
    expect((await rsvpGet(req("GET"), tokenCtx(VALID_ID))).status).toBe(500);
    expect(console.error).toHaveBeenCalledWith("RSVP load failure:", "unknown error");
  });

  it("checks the reply before looking up the link", async () => {
    setRsvpStore(failingRsvpStore(new Error("should not be reached")));
    const res = await rsvpPost(req("POST", { reply: "not an object" }), tokenCtx(VALID_ID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(Object.values(body.fields)[0]);
  });
});
