// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readJson, readText, removeKey, writeJson, writeText } from "@/lib/storage";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("safe browser storage", () => {
  it("writes, reads and removes JSON checked against a schema", () => {
    expect(writeJson("k", { n: 2 })).toBe(true);
    expect(readJson("k", z.object({ n: z.number() }))).toEqual({ n: 2 });
    removeKey("k");
    expect(readJson("k", z.object({ n: z.number() }))).toBeNull();
  });

  it("gives null for broken or unexpected saved data", () => {
    localStorage.setItem("k", "{not json");
    expect(readJson("k", z.unknown())).toBeNull();
    localStorage.setItem("k", JSON.stringify({ n: "two" }));
    expect(readJson("k", z.object({ n: z.number() }))).toBeNull();
  });

  it("keeps plain strings as they are", () => {
    expect(writeText("t", "mravi")).toBe(true);
    expect(readText("t")).toBe("mravi");
    expect(readText("missing")).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("blocked");
      });
    }
    expect(readJson("k", z.unknown())).toBeNull();
    expect(readText("k")).toBeNull();
    expect(writeJson("k", 1)).toBe(false);
    expect(writeText("k", "x")).toBe(false);
    expect(() => removeKey("k")).not.toThrow();
  });
});
