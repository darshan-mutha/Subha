import type { Plan } from "../schemas";

/* ------------------------------------------------------------------ */
/* Colour dots.                                                        */
/* ------------------------------------------------------------------ */

const NAMED: Record<string, string> = {
  red: "#B3261E",
  maroon: "#7A1F2B",
  crimson: "#A51C30",
  pink: "#E07A9A",
  rani: "#C2185B",
  orange: "#E07B24",
  marigold: "#E8A317",
  saffron: "#F28C28",
  yellow: "#F2C230",
  haldi: "#E9B824",
  gold: "#C9962B",
  ivory: "#F4EEDC",
  cream: "#F3E9D2",
  white: "#FFFFFF",
  beige: "#E8DCC4",
  peach: "#F4B393",
  green: "#2E7D4F",
  mint: "#9ED9B5",
  emerald: "#1F7A5A",
  teal: "#0E5A63",
  peacock: "#0E5A63",
  blue: "#2C5EA8",
  navy: "#1D2D50",
  turquoise: "#2BB3B1",
  purple: "#6A3D9A",
  lavender: "#B9A3D6",
  silver: "#B8BCC2",
  grey: "#8A8F94",
  gray: "#8A8F94",
  black: "#1B1B1B",
  brown: "#7B5134",
};

/** Colour dots for a theme: the plan's hex codes, or a best match for each colour name. */
export function themeSwatches(theme: Plan["theme"]): { name: string; hex: string }[] {
  return theme.colors
    .map((name, i) => {
      const given = theme.swatches?.[i];
      if (given) return { name, hex: given };
      const word = name
        .toLowerCase()
        .split(/[^a-z]+/)
        .reverse()
        .find((w) => NAMED[w]);
      return word ? { name, hex: NAMED[word] } : null;
    })
    .filter((x): x is { name: string; hex: string } => x !== null);
}
