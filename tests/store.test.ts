import { describe, expect, it } from "vitest";
import { createMemoryStore } from "@/lib/store";
import { planItems } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

const content = {
  input: baseInput,
  plan: samplePlan,
  timings: null,
  team: [{ id: "mravi", name: "Ravi", role: "" }],
  assignments: {},
};

describe("plan store", () => {
  it("creates, reads and ticks items", async () => {
    const store = createMemoryStore();
    const created = await store.create(content);
    expect(created.version).toBe(1);
    const [item] = planItems(samplePlan);
    await store.setDone(created.id, item.id, true);
    expect((await store.get(created.id))?.done[item.id]).toBe(true);
    expect(await store.get("missing")).toBeNull();
    expect(await store.setDone("missing", item.id, true)).toBeNull();
  });

  it("rejects an update based on an old version", async () => {
    const store = createMemoryStore();
    const created = await store.create(content);
    const updated = await store.update(created.id, { ...content, team: [] }, 1);
    expect(updated.version).toBe(2);
    await expect(store.update(created.id, content, 1)).rejects.toMatchObject({ status: 409 });
    await expect(store.update("missing", content, 1)).rejects.toMatchObject({ status: 404 });
  });

  it("drops ticks for tasks removed by a plan change", async () => {
    const store = createMemoryStore();
    const created = await store.create(content);
    const [first] = planItems(samplePlan);
    await store.setDone(created.id, first.id, true);
    const smaller = { ...samplePlan, timeline: samplePlan.timeline.slice(1) };
    const updated = await store.update(created.id, { ...content, plan: smaller }, 1);
    expect(updated.done[first.id]).toBeUndefined();
  });
});
