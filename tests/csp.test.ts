import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { buildCsp, createNonce } from "@/lib/csp";
import { proxy } from "@/proxy";

describe("Content Security Policy", () => {
  it("allows only scripts with the page's nonce", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-inline' ;");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("allows eval only in development", () => {
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
  });

  it("creates a different random nonce each time", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });

  it("sets the policy on the response and passes the nonce to rendering", () => {
    const res = proxy(new NextRequest("https://shuba.example/"));
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(csp.match(/'nonce-([^']+)'/)![1]);
  });
});
