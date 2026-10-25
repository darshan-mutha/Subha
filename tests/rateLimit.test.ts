import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "@/lib/rateLimit";

describe("rate limiter", () => {
  it("blocks after the limit and resets after the window", () => {
    const check = createRateLimiter(2, 1000);
    expect(check("a", 0).allowed).toBe(true);
    expect(check("a", 10).allowed).toBe(true);
    const blocked = check("a", 20);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(check("b", 20).allowed).toBe(true);
    expect(check("a", 1001).allowed).toBe(true);
  });

  it("uses the first forwarded IP as the client key", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientKey(new Headers())).toBe("anonymous");
  });
});
