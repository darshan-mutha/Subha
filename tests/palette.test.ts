import { describe, expect, it } from "vitest";
import { FINISHED, GREY, PROGRESS_STEPS, contrast, mixOklab, progressOf, tokenAt, type Scheme } from "@/lib/palette";
import { aliveFromProgress } from "@/components/PlanWorkspace";

const AA_TEXT = 4.5;
const AA_UI = 3;

describe("colour maths", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrast("#FFFFFF", "#0E5A63")).toBeCloseTo(7.9, 1);
  });

  it("mixing returns each end at 0% and 100%", () => {
    expect(mixOklab("#0E5A63", "#111111", 1)).toBe("#0E5A63");
    expect(mixOklab("#0E5A63", "#111111", 0)).toBe("#111111");
  });

  it("measures progress safely", () => {
    expect(progressOf(0, 0)).toBe(0);
    expect(progressOf(4, 1)).toBe(0.25);
    expect(progressOf(4, 9)).toBe(1);
  });

  it("eases colour in so the first ticks already show some", () => {
    expect(aliveFromProgress(0)).toBe(0);
    expect(aliveFromProgress(0.3)).toBeCloseTo(0.51, 2);
    expect(aliveFromProgress(1)).toBe(1);
  });
});

describe.each<Scheme>(["light", "dark"])("every colour pair stays readable (%s)", (scheme) => {
  const f = FINISHED[scheme];

  it.each(PROGRESS_STEPS)("at %s progress", (p) => {
    const primary = tokenAt(scheme, "primary", p);
    const bg = tokenAt(scheme, "bg", p);
    const chip = tokenAt(scheme, "accentSoft", p);
    const chipText = tokenAt(scheme, "onAccentSoft", p);

    // Text
    expect(contrast(f.onPrimary, primary)).toBeGreaterThanOrEqual(AA_TEXT); // primary buttons, active tab
    expect(contrast(primary, f.surface)).toBeGreaterThanOrEqual(AA_TEXT); // links and outline buttons
    expect(contrast(f.text, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(f.muted, bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(f.muted, f.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(chipText, chip)).toBeGreaterThanOrEqual(AA_TEXT); // due-soon and medium chips
    expect(contrast(f.text, chip)).toBeGreaterThanOrEqual(AA_TEXT); // facts and buttons on hover

    // Interface parts: focus ring and progress bar against their backgrounds
    expect(contrast(primary, bg)).toBeGreaterThanOrEqual(AA_UI);
  });

  it("keeps warnings in colour and readable from day one", () => {
    expect(contrast(f.danger, f.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(f.danger, f.dangerSoft)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(f.danger, GREY[scheme].bg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(f.success, f.surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("starts in true greys and ends in peacock and gold", () => {
    expect(tokenAt(scheme, "primary", 0)).toBe(GREY[scheme].primary.toUpperCase());
    expect(tokenAt(scheme, "primary", 1)).toBe(f.primary.toUpperCase());
    expect(tokenAt(scheme, "accent", 1)).toBe(f.accent.toUpperCase());
  });
});
