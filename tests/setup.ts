import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// The weather card makes its own network call; most tests leave it out so their
// fetch mocks only see the calls they expect. tests/weather-ui.test.tsx tests it.
vi.mock("@/components/WeatherCard", () => ({ WeatherCard: () => null }));

// jsdom has no canvas: its getContext logs "Not implemented" and returns null.
// Return null quietly instead, the same result the app already handles (axe and
// the invite card both fall back when there is no drawing context).
if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: () => null,
  });
}
