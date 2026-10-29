import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// The weather card makes its own network call; most tests leave it out so their
// fetch mocks only see the calls they expect. tests/weather-ui.test.tsx tests it.
vi.mock("@/components/WeatherCard", () => ({ WeatherCard: () => null }));
