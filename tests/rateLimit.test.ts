import { describe, expect, it } from "vitest";
import { clientKey, combineLimiters, createRateLimiter } from "@/lib/rateLimit";

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

  it("applies a short and a long window together, counting only allowed requests", () => {
    const check = combineLimiters({ limit: 2, windowMs: 1000 }, { limit: 3, windowMs: 10_000 });
    expect(check("a", 0).allowed).toBe(true);
    expect(check("a", 1).allowed).toBe(true);
    expect(check("a", 2).allowed).toBe(false);
    expect(check("a", 1001).allowed).toBe(true);
    const daily = check("a", 2002);
    expect(daily.allowed).toBe(false);
    expect(daily.retryAfterSec).toBe(8);
    expect(check("b", 2002).allowed).toBe(true);
    expect(check("a", 10_001).allowed).toBe(true);
  });

  it("prefers the platform-set IP as the client key", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientKey(new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers())).toBe("anonymous");
  });
});
