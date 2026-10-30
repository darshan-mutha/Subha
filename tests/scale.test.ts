import { describe, expect, it } from "vitest";
import { scaleToTotal } from "@/lib/scale";

describe("scaleToTotal", () => {
  it("scales in proportion and adds up exactly", () => {
    const out = scaleToTotal([1, 1, 1], 10_000, { step: 100 });
    expect(out.reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(out).toEqual([3_400, 3_300, 3_300]);
  });

  it("puts the remainder in the largest item, the first if several tie", () => {
    expect(scaleToTotal([1, 3, 3], 700, { step: 100 })).toEqual([100, 300, 300]);
    expect(scaleToTotal([1, 1, 1], 10, { step: 1 })).toEqual([4, 3, 3]);
  });

  it("keeps each item at the minimum when one is given", () => {
    expect(scaleToTotal([1, 100], 100, { step: 5, min: 5 })).toEqual([5, 95]);
  });

  it("floors the largest at zero unless told not to", () => {
    expect(scaleToTotal([1, 1], 0, { step: 100, min: 100 })).toEqual([0, 100]);
    expect(scaleToTotal([1, 1], 0, { step: 100, min: 100, floorAtZero: false })).toEqual([-100, 100]);
  });

  it("returns an empty list for no items", () => {
    expect(scaleToTotal([], 100, { step: 1 })).toEqual([]);
  });
});
