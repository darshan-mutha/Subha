/**
 * Shubā colour system: "comes alive".
 *
 * A plan starts in calm black and white and blends into peacock teal and gold
 * as tasks get done. The CSS does the blending with
 * `color-mix(in oklch, finished p%, grey)`, where p is the share of tasks done.
 * This module holds the same tokens and the same maths, so tests can prove that
 * every colour pair stays readable at every stage of progress.
 */

export type Scheme = "light" | "dark";

/** Colours of a fully planned celebration. */
export const FINISHED = {
  light: {
    primary: "#0E5A63",
    onPrimary: "#FFFFFF",
    accent: "#C9962B",
    accentSoft: "#F3E3BC",
    onAccentSoft: "#5E4410",
    bg: "#F7F4EC",
    surface: "#FFFFFF",
    text: "#162426",
    muted: "#4A5C5E",
    border: "#DCD6C8",
    success: "#1E6B45",
    danger: "#9C3A26",
    dangerSoft: "#F7E3DE",
  },
  dark: {
    primary: "#5FC2CC",
    onPrimary: "#0F1B1D",
    accent: "#E2B657",
    accentSoft: "#3A2E14",
    onAccentSoft: "#F3E3BC",
    bg: "#0F1B1D",
    surface: "#16262A",
    text: "#EDE6D6",
    muted: "#A9BDBF",
    border: "#2A3B3E",
    success: "#6FCF97",
    danger: "#F08A73",
    dangerSoft: "#3B1F19",
  },
} as const;

/** The black-and-white starting point for the colours that blend. */
export const GREY = {
  light: {
    primary: "#111111",
    accent: "#6B6B6B",
    accentSoft: "#EDEDED",
    onAccentSoft: "#2B2B2B",
    bg: "#FFFFFF",
    border: "#E2E2E2",
  },
  dark: {
    primary: "#F2F2F2",
    accent: "#9A9A9A",
    accentSoft: "#2A2A2A",
    onAccentSoft: "#EDEDED",
    bg: "#111111",
    border: "#333333",
  },
} as const;

export type MixedToken = keyof (typeof GREY)["light"];

/** Progress steps at which contrast is verified. */
export const PROGRESS_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;

/* ------------------------------------------------------------------ */
/* Colour maths (sRGB <-> OKLab/OKLCH), as used by CSS color-mix.      */
/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as RGB;
}

export function rgbToHex([r, g, b]: RGB): string {
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab(rgb: RGB): RGB {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear) as RGB;
}

/** Same result as CSS `color-mix(in oklab, colour p, grey)`. */
export function mixOklab(colour: string, grey: string, p: number): string {
  const c = rgbToOklab(hexToRgb(colour));
  const g = rgbToOklab(hexToRgb(grey));
  return rgbToHex(oklabToRgb(c.map((v, i) => v * p + g[i] * (1 - p)) as RGB));
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour of a blending token at a given progress. */
export function tokenAt(scheme: Scheme, token: MixedToken, p: number): string {
  return mixOklab(FINISHED[scheme][token], GREY[scheme][token], p);
}

/** Share of tasks done, 0 to 1. */
export function progressOf(total: number, done: number): number {
  return total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
}
