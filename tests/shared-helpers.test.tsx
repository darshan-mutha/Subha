import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fieldErrorWiring } from "@/components/fieldErrors";
import { EXAMPLES, exampleValues } from "@/components/event-form/formValues";
import { aiOrStandard, PlannerError } from "@/lib/ai";
import { fullDateIn, isRealDate, todayIST } from "@/lib/dates";
import { ID, localId, TOKEN } from "@/lib/ids";
import { memoryCache } from "@/lib/memoryCache";
import { createMemoryRsvpStore } from "@/lib/rsvpStore";
import { createMemoryStore } from "@/lib/store";
import {
  GUEST_NAME_TEXT,
  knownOnly,
  knownValues,
  NAME_TEXT,
  nameField,
  NO_MARKUP,
  phoneField,
  plainText,
  SAFE_TEXT,
  UNSAFE_CHARS,
  validItems,
  validList,
} from "@/lib/validation";
import { WeatherRequestSchema } from "@/lib/weather";
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

describe("one place for each rule", () => {
  it("every id made by localId matches the pattern it is checked against", () => {
    expect(localId("g")).toMatch(ID.guest);
    expect(localId("q")).toMatch(ID.quote);
    expect(localId("m")).toMatch(ID.member);
    expect(localId("e")).toMatch(ID.event);
    expect("rabc123").toMatch(ID.party);
    expect("gabcd").toMatch(ID.party);
    expect("xabcd").not.toMatch(ID.party);
    expect("AbCdEfGhIjKlMnOpQrStUv").toMatch(TOKEN);
    expect("too-short").not.toMatch(TOKEN);
  });

  it("checks names, phone numbers and AI text the same way everywhere", () => {
    const name = nameField(10, { empty: "Empty", invalid: "Bad" });
    expect(name.safeParse("  Ravi ").data).toBe("Ravi");
    expect(name.safeParse("").error?.issues[0].message).toBe("Empty");
    expect(name.safeParse("<b>").error?.issues[0].message).toBe("Bad");
    expect(name.safeParse("A very long name").error?.issues[0].message).toBe("Name is too long");
    expect(nameField(20, { empty: "", invalid: "" }, GUEST_NAME_TEXT).safeParse("Ravi + Meena").success).toBe(true);
    expect(name.safeParse("Ravi + Meena").success).toBe(false);

    expect(phoneField().parse(undefined)).toBe("");
    expect(phoneField().safeParse("+91 98450-12345").success).toBe(true);
    expect(phoneField().safeParse("call me").success).toBe(false);

    expect(plainText(20).parse("  <b>Hello</b>\n world ")).toBe("bHello/b world");
    expect(plainText(20).safeParse("<>{}").success).toBe(false);
    expect(NO_MARKUP.test("Plain words, ₹500!")).toBe(true);
    expect(NO_MARKUP.test("{oops}")).toBe(false);
  });

  it("knows real calendar dates", () => {
    expect(isRealDate("2028-02-29")).toBe(true);
    expect(isRealDate("2027-02-29")).toBe(false);
    expect(isRealDate("2026-02-30")).toBe(false);
    expect(isRealDate("2026-1-5")).toBe(false);
    expect(WeatherRequestSchema.safeParse({ city: "Pune", date: "2026-02-30" }).success).toBe(false);
  });
});

describe("memoryCache", () => {
  it("drops the oldest entry when full, and re-adding counts as new", () => {
    const cache = memoryCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 3); // "a" is now newest
    cache.set("c", 4);
    expect(cache.size).toBe(2);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(3);
    expect(cache.get("c")).toBe(4);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("forgets an entry once its time is up, and keeps null answers", () => {
    const cache = memoryCache<string | null>(5);
    cache.set("gone", "x", 1000, 0);
    cache.set("none", null);
    expect(cache.get("gone", 999)).toBe("x");
    expect(cache.get("gone", 1000)).toBeUndefined();
    expect(cache.size).toBe(1);
    expect(cache.get("none")).toBeNull();
  });
});

describe("aiOrStandard", () => {
  it("uses the AI's answer when it comes", async () => {
    await expect(
      aiOrStandard(
        async () => "ai words",
        () => "standard",
      ),
    ).resolves.toEqual({
      value: "ai words",
      source: "ai",
    });
  });

  it("falls back to the standard answer when the AI is busy or fails", async () => {
    const busy = aiOrStandard(
      () => Promise.reject(new PlannerError("Busy", 503)),
      () => "standard",
    );
    await expect(busy).resolves.toEqual({ value: "standard", source: "standard" });
    const broken = aiOrStandard(
      () => Promise.reject(new Error("network")),
      () => "standard",
    );
    await expect(broken).resolves.toEqual({ value: "standard", source: "standard" });
  });

  it("passes a refusal on instead of hiding it", async () => {
    const refused = aiOrStandard(
      () => Promise.reject(new PlannerError("Not an event", 422)),
      () => "standard",
    );
    await expect(refused).rejects.toMatchObject({ status: 422 });
  });
});
