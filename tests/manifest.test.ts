import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("web app manifest", () => {
  it("names the app and opens it standalone from the home page", () => {
    const m = manifest();
    expect(m.short_name).toBe("Shubā");
    expect(m.name).toContain("Shubā");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("lists an SVG icon and the 192 and 512 pixel PNG icons", () => {
    const icons = manifest().icons ?? [];
    expect(icons.map((i) => i.sizes)).toEqual(["any", "192x192", "512x512"]);
    expect(icons.every((i) => i.src.startsWith("/"))).toBe(true);
  });
});
