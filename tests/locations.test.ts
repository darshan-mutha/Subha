import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocationCache, findKnownCity, findLocation } from "@/lib/locations";

beforeEach(() => clearLocationCache());

describe("findLocation", () => {
  it("finds major Indian cities without a network call", async () => {
    const fetcher = vi.fn();
    const loc = await findLocation("  bengaluru ", fetcher as unknown as typeof fetch);
    expect(loc?.timeZone).toBe("Asia/Kolkata");
    expect(fetcher).not.toHaveBeenCalled();
    expect(findKnownCity("Atlantis")).toBeNull();
  });

  it("falls back to the geocoding service and caches the answer", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ name: "Hampi", latitude: 15.33, longitude: 76.46, timezone: "Asia/Kolkata", country: "India" }],
        }),
      ),
    );
    const first = await findLocation("Hampi", fetcher as unknown as typeof fetch);
    const second = await findLocation("hampi", fetcher as unknown as typeof fetch);
    expect(first?.name).toBe("Hampi, India");
    expect(second).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain("name=Hampi");
  });

  it("returns null when the service fails, instead of throwing", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(findLocation("Nowhere", fetcher as unknown as typeof fetch)).resolves.toBeNull();
  });

  it("returns null when the city is not found", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({})));
    await expect(findLocation("Qwertyville", fetcher as unknown as typeof fetch)).resolves.toBeNull();
  });
});
