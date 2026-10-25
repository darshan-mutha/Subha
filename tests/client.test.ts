// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiStatusError,
  clearPlan,
  createShared,
  loadPlan,
  loadShared,
  loadViewer,
  requestAssign,
  requestPlan,
  saveProgress,
  savePlan,
  saveViewer,
  updateShared,
} from "@/lib/client";
import { baseInput, samplePlan } from "./fixtures";

const reply = (body: unknown, status = 200) =>
  vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

afterEach(() => vi.unstubAllGlobals());

describe("API client", () => {
  it("posts JSON and returns the plan", async () => {
    const fetchMock = reply({ input: baseInput, plan: samplePlan, timings: null });
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestPlan(baseInput);
    expect(result.plan.summary).toBe(samplePlan.summary);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("surfaces server messages, field errors and status", async () => {
    vi.stubGlobal(
      "fetch",
      reply({ error: "Please check the highlighted fields.", fields: { city: "Please enter a city" } }, 400),
    );
    const error = await requestPlan(baseInput).catch((e) => e);
    expect(error).toBeInstanceOf(ApiStatusError);
    expect(error).toMatchObject({ status: 400, fields: { city: "Please enter a city" } });
  });

  it("explains network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(requestPlan(baseInput)).rejects.toThrow(/internet connection/);
  });

  it("handles a non-JSON error page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));
    await expect(requestPlan(baseInput)).rejects.toThrow(/Something went wrong/);
  });

  it("calls the team and sharing endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ assignments: {} })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "x".repeat(22) })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ plan: samplePlan })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ plan: samplePlan })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ done: {} })));
    vi.stubGlobal("fetch", fetchMock);
    const content = { input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {} };
    await requestAssign(baseInput, samplePlan, []);
    await createShared(content, {});
    await loadShared("abc");
    await updateShared("abc", 1, content);
    await saveProgress("abc", "t_1", true);
    expect(fetchMock.mock.calls.map((c) => [c[0], c[1].method])).toEqual([
      ["/api/assign", "POST"],
      ["/api/plans", "POST"],
      ["/api/plans/abc", "GET"],
      ["/api/plans/abc", "PUT"],
      ["/api/plans/abc/progress", "POST"],
    ]);
  });
});

describe("saved data in this browser", () => {
  it("saves, loads and clears the working plan", () => {
    const ws = { input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {}, done: {} };
    savePlan(ws);
    expect(loadPlan()).toEqual(ws);
    clearPlan();
    expect(loadPlan()).toBeNull();
  });

  it("remembers whose tasks to show per plan", () => {
    saveViewer("p1", "mravi");
    expect(loadViewer("p1")).toBe("mravi");
    expect(loadViewer("p2")).toBe("");
  });

  it("survives storage being unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadPlan()).toBeNull();
    expect(loadViewer("p1")).toBe("");
    expect(() => saveViewer("p1", "m")).not.toThrow();
    spy.mockRestore();
    vi.restoreAllMocks();
  });
});
