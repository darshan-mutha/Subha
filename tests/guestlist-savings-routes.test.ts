import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as guestlistPost } from "@/app/api/guestlist/route";
import { POST as savingsPost } from "@/app/api/savings/route";
import type * as AiLib from "@/lib/ai";
import { baseInput, samplePlan } from "./fixtures";

const generate = vi.hoisted(() => vi.fn<() => Promise<string>>());

// Stand in for Claude so the routes run end to end without a network call.
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof AiLib>();
  return { ...actual, claudeGenerator: generate };
});

let ip = 0;
/** A JSON POST from its own address, so rate limits don't carry over between tests. */
function post(body: unknown, { from = `10.20.0.${++ip}`, contentType = "application/json" } = {}) {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": contentType, "x-forwarded-for": from },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const groupsBody = { input: baseInput, functions: ["Mehendi"] };
const savingsBody = { input: baseInput, budget: samplePlan.budget, vendors: [], mode: "cut", need: 5000 };

const aiGroups = JSON.stringify({
  groups: [
    { name: "Family", about: 30, who: "Grandparents and cousins", side: "family" },
    { name: "Friends", about: 10, who: "School friends", side: "friends" },
  ],
  reminders: ["Helpers need food too"],
});

const aiOptions = JSON.stringify({
  options: [
    {
      kind: "cheaper-options",
      title: "Simpler decor",
      detail: "Use balloons and fabric.",
      saving: 3000,
      affects: "Decor looks simpler.",
      instruction: "Cut the decor budget by 3000 and use simpler balloons.",
    },
    {
      kind: "fewer-guests",
      title: "Fewer guests",
      detail: "Invite 5 fewer families.",
      saving: 2500,
      affects: "A smaller party.",
      instruction: "Reduce the guest count by 5 and cut food to match.",
    },
  ],
});

beforeEach(() => {
  generate.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/guestlist", () => {
  it("returns Claude's groups, scaled to the planned guests", async () => {
    generate.mockResolvedValue(aiGroups);
    const res = await guestlistPost(post(groupsBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = await res.json();
    expect(data.source).toBe("ai");
    expect(data.groups.map((g: { about: number }) => g.about).reduce((a: number, b: number) => a + b, 0)).toBe(
      baseInput.guests,
    );
    expect(data.reminders).toEqual(["Helpers need food too"]);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("falls back to standard groups when the AI fails", async () => {
    generate.mockRejectedValue(new Error("down"));
    const res = await guestlistPost(post(groupsBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("standard");
    expect(data.groups.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects bad JSON, the wrong content type, bad fields and large bodies", async () => {
    expect((await guestlistPost(post("{bad json"))).status).toBe(400);
    expect((await guestlistPost(post("x", { contentType: "text/plain" }))).status).toBe(415);
    const invalid = await guestlistPost(post({ ...groupsBody, input: { ...baseInput, guests: 0 } }));
    expect(invalid.status).toBe(400);
    expect(Object.keys((await invalid.json()).fields)).toContain("input.guests");
    const big = await guestlistPost(post({ ...groupsBody, pad: "a".repeat(9_000) }));
    expect(big.status).toBe(413);
    expect(generate).not.toHaveBeenCalled();
  });

  it("rate limits repeated requests from one address", async () => {
    generate.mockResolvedValue(aiGroups);
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await guestlistPost(post(groupsBody, { from: "10.21.0.1" }))).status);
    expect(statuses.every((s) => s === 200)).toBe(true);
    const last = await guestlistPost(post(groupsBody, { from: "10.21.0.1" }));
    expect(last.status).toBe(429);
    expect(last.headers.get("retry-after")).toBeTruthy();
  });
});

describe("POST /api/savings", () => {
  it("returns Claude's choices", async () => {
    generate.mockResolvedValue(aiOptions);
    const res = await savingsPost(post(savingsBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("ai");
    expect(data.options.map((o: { kind: string }) => o.kind)).toEqual(["cheaper-options", "fewer-guests"]);
  });

  it("falls back to standard choices when the AI fails", async () => {
    generate.mockRejectedValue(new Error("down"));
    const res = await savingsPost(post(savingsBody));
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("standard");
  });

  it("rejects bad JSON, bad fields and large bodies", async () => {
    expect((await savingsPost(post("{bad json"))).status).toBe(400);
    const invalid = await savingsPost(post({ ...savingsBody, need: 5 }));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).fields.need).toBe("Please enter at least ₹100");
    const big = await savingsPost(post({ ...savingsBody, pad: "a".repeat(13_000) }));
    expect(big.status).toBe(413);
    expect(generate).not.toHaveBeenCalled();
  });

  it("rate limits repeated requests from one address", async () => {
    generate.mockResolvedValue(aiOptions);
    for (let i = 0; i < 10; i++) await savingsPost(post(savingsBody, { from: "10.21.0.2" }));
    expect((await savingsPost(post(savingsBody, { from: "10.21.0.2" }))).status).toBe(429);
  });
});
