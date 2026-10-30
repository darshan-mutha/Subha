// @vitest-environment jsdom
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import type { LocalWorkspace } from "@/lib/client";
import { schedule } from "@/lib/schedule";
import { planStructure } from "@/lib/team";
import { nextLine, stageTag, vendorSummary } from "@/lib/vendorSummary";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection, openSection } from "./nav";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const [caterer, entertainer] = planStructure(samplePlan).vendors.map((v) => v.id);
const quote = (id: string, amount: number) => ({ id, vendorName: `V ${id}`, phone: "", amount, includes: "" });
const deals = {
  [caterer]: {
    quotes: [quote("qa", 22000), quote("qb", 18000)],
    booked: "qb",
    advance: 5000,
    budgetCategory: "Food",
    agreement: "",
  },
  [entertainer]: { quotes: [quote("qc", 9000)], booked: "", advance: 0, budgetCategory: "", agreement: "" },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("vendor summary", () => {
  const scheduled = (today: string) => schedule(samplePlan, baseInput.date, today, { [caterer]: true }, {}).vendors;

  it("counts vendors by stage, quotes in and money", () => {
    const s = vendorSummary(scheduled("2026-10-26"), samplePlan, deals, { [caterer]: true });
    expect(s.needed).toBe(samplePlan.vendors.length);
    expect(s.booked.map((r) => r.type)).toEqual(["Caterer"]);
    expect(s.gettingQuotes.map((r) => r.type)).toEqual(["Entertainer"]);
    expect(s.quotesIn).toBe(3);
    expect(s.quotesToCompare).toBe(1);
    expect(s.payments).toMatchObject({ committed: 18000, advancePaid: 5000, balanceDue: 13000 });
    expect(s.vendorBudget).toBeGreaterThanOrEqual(20000);
    expect(s.next?.type).toBe("Entertainer");
    expect(nextLine(s.next!, "2026-10-26")).toContain("1 quote in; cheapest ₹9,000");
    expect(stageTag(s.booked[0]).text).toBe("Booked · ₹18,000");
  });

  it("puts overdue vendors first and says how late", () => {
    const s = vendorSummary(scheduled("2026-12-10"), samplePlan, {}, {});
    expect(s.overdue.length).toBeGreaterThan(0);
    expect(s.next?.overdue).toBe(true);
    expect(nextLine(s.next!, "2026-12-10")).toMatch(/overdue by \d+ days?/);
    expect(stageTag(s.next!)).toMatchObject({ tone: "bad" });
    expect(stageTag(s.notStarted[0]).text).toMatch(/^Overdue · Not started|^Not started · by/);
  });
});

describe("Vendors section summary", () => {
  it("shows booked count, money and the next vendor, grouped To book / Booked", async () => {
    const user = userEvent.setup();
    const data: LocalWorkspace = {
      input: baseInput,
      plan: samplePlan,
      timings: null,
      team: [],
      assignments: {},
      done: { [caterer]: true },
      deals,
    };
    const { container } = render(
      <PlanWorkspace
        planKey="vs"
        data={data}
        shareUrl={null}
        onChange={vi.fn().mockResolvedValue(undefined)}
        onToggle={vi.fn()}
        onShare={null}
        onEdit={null}
        onStartOver={vi.fn()}
        viewer=""
        onViewerChange={vi.fn()}
      />,
    );
    await openSection("Vendors");
    const section = within(currentSection());
    const summary = within(section.getByRole("region", { name: "Vendor summary" }));
    expect(summary.getByText("1 of 2 booked")).toBeInTheDocument();
    expect(summary.getByText("₹18,000")).toBeInTheDocument();
    expect(summary.getByText("₹13,000")).toBeInTheDocument();
    expect(summary.getByText(/Book next/).parentElement).toHaveTextContent("Entertainer");
    expect(
      summary.getByRole("img", { name: /1 booked, 1 getting quotes, 0 not started, out of 2/ }),
    ).toBeInTheDocument();

    const toBook = within(section.getByRole("region", { name: /^To book/ }));
    const booked = within(section.getByRole("region", { name: /^Booked/ }));
    expect(toBook.getByRole("button", { name: /^Entertainer/ })).toHaveTextContent("1 quote · ₹9,000");
    expect(booked.getByRole("button", { name: /^Caterer/ })).toHaveTextContent("₹18,000 · ₹13,000 due");
    expect(booked.getByRole("button", { name: /^Caterer/ })).toHaveTextContent("✓ Booked");
    expect(await axe.run(container).then((r) => r.violations.map((v) => v.id))).toEqual([]);

    // "Open" goes to the next vendor, on its Compare step.
    await user.click(summary.getByRole("button", { name: "Open Entertainer" }));
    const panel = within(section.getByRole("region", { name: "Entertainer" }));
    expect(panel.getByRole("button", { name: "2 Compare" })).toHaveAttribute("aria-pressed", "true");
    expect(toBook.getByRole("button", { name: /^Entertainer/ })).toHaveAttribute("aria-current", "true");
  });
});

describe("short amounts", () => {
  it("uses lakh and crore for big numbers", async () => {
    const { formatShortINR } = await import("@/lib/budget");
    expect(formatShortINR(45000)).toBe("₹45,000");
    expect(formatShortINR(720000)).toBe("₹7.2 L");
    expect(formatShortINR(2015000)).toBe("₹20.2 L");
    expect(formatShortINR(600000)).toBe("₹6 L");
    expect(formatShortINR(12_500_000)).toBe("₹1.25 Cr");
  });
});

describe("vendor rows", () => {
  it("says the status in words and picks a picture", async () => {
    const { rowStatus, rowDetail, vendorIcon, currentStep } = await import("@/lib/vendorSummary");
    const base = {
      id: "v1",
      type: "Caterer",
      mustHave: true,
      stage: "not-started" as const,
      overdue: false,
      due: "2026-11-10",
      quotes: 0,
      cheapest: null,
      bookedAmount: null,
      advance: 0,
    };
    expect(rowStatus(base).text).toBe("Not started");
    expect(rowDetail(base)).toBe("Book by 10 Nov");
    expect(rowStatus({ ...base, overdue: true })).toEqual({ text: "Overdue", tone: "late" });
    expect(rowDetail({ ...base, overdue: true })).toBe("Was due 10 Nov");
    expect(rowDetail({ ...base, stage: "quotes", quotes: 2, cheapest: 720000 })).toBe("2 quotes · lowest ₹7.2 L");
    expect(currentStep({ ...base, stage: "quotes", quotes: 2 })).toBe("compare");
    const booked = { ...base, stage: "booked" as const, bookedAmount: 45000, advance: 45000 };
    expect(rowDetail(booked)).toBe("₹45,000 · paid");
    expect(rowDetail({ ...booked, bookedAmount: 600000, advance: 200000 })).toBe("₹6 L · ₹4 L due");
    expect(rowDetail({ ...booked, bookedAmount: null })).toBe("Marked as booked");
    expect(currentStep(booked)).toBe("book");
    expect(vendorIcon("Venue (heritage haveli)")).toBe("🏛️");
    expect(vendorIcon("Pandit ji / wedding priest")).toBe("🪔");
    expect(vendorIcon("Something new")).toBe("🤝");
  });
});

describe("short vendor names", () => {
  it("drops the details in brackets", async () => {
    const { shortName } = await import("@/lib/vendorSummary");
    expect(shortName("Venue (heritage haveli or garden lawn)")).toBe("Venue");
    expect(shortName("Music: DJ, dhol & folk artists")).toBe("Music");
    expect(shortName("Pandit ji / wedding priest")).toBe("Pandit ji / wedding priest");
    expect(shortName("(odd)")).toBe("(odd)");
  });
});
