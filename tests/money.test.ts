import { describe, expect, it } from "vitest";
import { formatINR, formatLakhCrore, formatShortINR } from "@/lib/money";

describe("money", () => {
  it("formats rupees in the Indian way", () => {
    expect(formatINR(1_250_000)).toBe("₹12,50,000");
    expect(formatINR(999.6)).toBe("₹1,000");
  });

  it("has a compact form for tight spaces", () => {
    expect(formatShortINR(45_000)).toBe("₹45,000");
    expect(formatShortINR(720_000)).toBe("₹7.2 L");
    expect(formatShortINR(12_500_000)).toBe("₹1.25 Cr");
  });

  it("has a spelled-out form for budget suggestions", () => {
    expect(formatLakhCrore(45_000)).toBe("₹45,000");
    expect(formatLakhCrore(320_000)).toBe("₹3.2 lakh");
    expect(formatLakhCrore(12_500_000)).toBe("₹1.25 crore");
  });
});
