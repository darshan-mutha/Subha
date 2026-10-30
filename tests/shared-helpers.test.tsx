import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fieldErrorWiring } from "@/components/fieldErrors";
import { EXAMPLES, exampleValues } from "@/components/event-form/formValues";
import { fullDateIn, todayIST } from "@/lib/dates";
import { localId } from "@/lib/ids";
import { createMemoryRsvpStore } from "@/lib/rsvpStore";
import { createMemoryStore } from "@/lib/store";
import { knownOnly, knownValues, NAME_TEXT, SAFE_TEXT, UNSAFE_CHARS, validItems, validList } from "@/lib/validation";
import { baseInput, samplePlan } from "./fixtures";

describe("localId", () => {
  it("starts with the prefix, uses only lowercase letters and digits, and differs each time", () => {
    const a = localId("g");
    expect(a).toMatch(/^g[a-z0-9]{8}$/);
    expect(localId("g")).not.toBe(a);
    expect(localId("q", 4)).toMatch(/^q[a-z0-9]{4}$/);
  });
});

describe("validation helpers", () => {
  const Item = z.object({ n: z.number() });

  it("keeps the valid items and drops the rest", () => {
    expect(validItems([{ n: 1 }, "bad", { n: 2 }, null], Item)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("validList caps the list and turns anything else into an empty list", () => {
    const List = validList(Item, 2);
    expect(List.parse([{ n: 1 }, { n: 2 }, { n: 3 }])).toEqual([{ n: 1 }, { n: 2 }]);
    expect(List.parse("nope")).toEqual([]);
    expect(validList(Item).parse([{ n: 1 }, {}, { n: 2 }])).toHaveLength(2);
  });

  it("knownValues keeps known values once, in the order given", () => {
    expect(knownValues(["b", "a", "b", "zzz"], ["a", "b"] as const)).toEqual(["b", "a"]);
    const Known = knownOnly(["a", "b", "c"] as const, 2);
    expect(Known.parse(["c", "x", "a", "b"])).toEqual(["c", "a"]);
    expect(Known.parse(42)).toEqual([]);
    expect(Known.parse(undefined)).toEqual([]);
  });

  it("text rules allow Indian names and everyday punctuation but not markup", () => {
    expect(SAFE_TEXT.test("Aarav turns 5! ₹500 @ 7pm (home)")).toBe(true);
    expect(SAFE_TEXT.test("<script>")).toBe(false);
    expect(NAME_TEXT.test("Sharma ji & family")).toBe(true);
    expect(NAME_TEXT.test("Sharma!")).toBe(false);
    expect("a<b>{c}".replace(UNSAFE_CHARS, "")).toBe("abc");
  });
});

describe("fieldErrorWiring", () => {
  it("links a control to its message only when there is an error", () => {
    const { err, invalid } = fieldErrorWiring("f", { name: "Please enter a name" });
    expect(invalid("name")).toEqual({ "aria-invalid": true, "aria-describedby": "f-name-err" });
    expect(invalid("phone")).toEqual({ "aria-invalid": undefined, "aria-describedby": undefined });
    expect(renderToStaticMarkup(<>{err("name")}</>)).toBe(
      '<p class="field-error" id="f-name-err">Please enter a name</p>',
    );
    expect(err("phone")).toBeNull();
  });

  it("can use another id ending, for forms that already had one", () => {
    const { invalid } = fieldErrorWiring("f", { city: "x" }, "error");
    expect(invalid("city")["aria-describedby"]).toBe("f-city-error");
  });
});

describe("example presets", () => {
  it("date the example from today each time it is used", () => {
    const today = todayIST();
    for (const example of EXAMPLES) {
      const values = exampleValues(example);
      expect(values.date > today).toBe(true);
      expect(values.eventType).toBe(example.values.eventType);
    }
  });
});

describe("fullDateIn", () => {
  it("writes the full date in the given language and leaves non-dates alone", () => {
    expect(fullDateIn("2026-12-12", "en-IN")).toBe("Saturday, 12 December 2026");
    expect(fullDateIn("2026-12-12", "hi-IN")).toContain("दिसंबर");
    expect(fullDateIn("", "en-IN")).toBe("");
    expect(fullDateIn("soon", "en-IN")).toBe("soon");
  });
});

describe("stores", () => {
  it("says whether a plan exists without loading it", async () => {
    const store = createMemoryStore();
    const plan = await store.create({ input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {} });
    expect(await store.exists(plan.id)).toBe(true);
    expect(await store.exists("missing")).toBe(false);
  });

  it("reopens a closed guest link with the same token in one step", async () => {
    const store = createMemoryRsvpStore();
    const first = await store.openLink("plan");
    await store.setOpen("plan", false);
    const again = await store.openLink("plan");
    expect(again).toEqual({ ...first, open: true });
  });
});
