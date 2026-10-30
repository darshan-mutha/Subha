import { describe, expect, it } from "vitest";
import type { ScheduledItem } from "@/lib/schedule";
import { currentStep, rowDetail, rowStatus, shortName, vendorIcon, vendorSummary } from "@/lib/vendorSummary";
import type { VendorRow } from "@/lib/vendorSummary";
import { samplePlan } from "./fixtures";

const row = (over: Partial<VendorRow> = {}): VendorRow => ({
  id: "v1",
  type: "Caterer (veg)",
  mustHave: true,
  stage: "not-started",
  overdue: false,
  due: "2026-11-20",
  quotes: 0,
  cheapest: null,
  bookedAmount: null,
  advance: 0,
  ...over,
});

const item = (id: string, label: string, due: string): ScheduledItem => ({
  id,
  label,
  kind: "vendor",
  group: "Vendors",
  priority: "high",
  due,
  status: "upcoming",
  milestone: false,
  shifted: 0,
});

describe("vendorSummary row building", () => {
  it("uses the item's label when the plan has fewer vendors than scheduled items", () => {
    const items = [item("a", "Caterer", "2026-11-01"), item("b", "Book a florist", "2026-11-05")];
    const s = vendorSummary(items, { ...samplePlan, vendors: [samplePlan.vendors[0]] }, {}, {});
    expect(s.rows.map((r) => r.type)).toEqual(["Caterer", "Book a florist"]);
    expect(s.rows[1].mustHave).toBe(false);
  });

  it("counts a ticked-off vendor as booked even without a quote", () => {
    const s = vendorSummary([item("a", "Caterer", "2026-11-01")], samplePlan, {}, { a: true });
    expect(s.rows[0]).toMatchObject({ stage: "booked", bookedAmount: null, advance: 0 });
    expect(s.next).toBeNull();
  });

  it("caps the advance at the booked amount", () => {
    const deals = {
      a: {
        quotes: [{ id: "q1", vendorName: "X", phone: "", amount: 10000, includes: "" }],
        booked: "q1",
        advance: 25000,
        budgetCategory: "",
        agreement: "",
      },
    };
    const s = vendorSummary([item("a", "Caterer", "2026-11-01")], samplePlan, deals, {});
    expect(s.rows[0].advance).toBe(10000);
  });

  it("books the must-have vendor first when two are due on the same day", () => {
    const items = [item("a", "Entertainer", "2026-11-01"), item("b", "Caterer", "2026-11-01")];
    const plan = { ...samplePlan, vendors: [samplePlan.vendors[1], samplePlan.vendors[0]] };
    expect(vendorSummary(items, plan, {}, {}).next?.id).toBe("b");
  });
});

describe("labels for a vendor", () => {
  it("says 'Marked as booked' when a vendor is ticked off without an amount", () => {
    expect(rowDetail(row({ stage: "booked" }))).toBe("Marked as booked");
  });

  it("describes payment state for a booked vendor", () => {
    expect(rowDetail(row({ stage: "booked", bookedAmount: 60000, advance: 60000 }))).toMatch(/· paid$/);
    expect(rowDetail(row({ stage: "booked", bookedAmount: 60000, advance: 20000 }))).toMatch(/due$/);
  });

  it("describes quotes and due dates for an unbooked vendor", () => {
    expect(rowDetail(row({ stage: "quotes", quotes: 1, cheapest: null }))).toMatch(/^1 quote · /);
    expect(rowDetail(row({ stage: "quotes", quotes: 3, cheapest: 7000 }))).toMatch(/^3 quotes · lowest /);
    expect(rowDetail(row({ overdue: true }))).toMatch(/^Was due /);
    expect(rowDetail(row())).toMatch(/^Book by /);
  });

  it("gives each stage its status, step and colour", () => {
    expect(rowStatus(row({ stage: "booked" }))).toEqual({ text: "Booked", tone: "ok" });
    expect(rowStatus(row({ overdue: true }))).toEqual({ text: "Overdue", tone: "late" });
    expect(rowStatus(row({ stage: "quotes" }))).toEqual({ text: "Quotes in", tone: "quotes" });
    expect(rowStatus(row())).toEqual({ text: "Not started", tone: "new" });
    expect(currentStep(row({ stage: "booked" }))).toBe("book");
    expect(currentStep(row({ stage: "quotes" }))).toBe("compare");
    expect(currentStep(row())).toBe("ask");
  });

  it("keeps the full name when cutting the brackets would leave nothing", () => {
    expect(shortName("(Venue)")).toBe("(Venue)");
    expect(shortName("Venue: lawn")).toBe("Venue");
  });

  it("falls back to a handshake icon for unknown vendor types", () => {
    expect(vendorIcon("Something unusual")).toBe("🤝");
    expect(vendorIcon("Pandit ji")).toBe("🪔");
  });
});
