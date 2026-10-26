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

describe("Vendors section dashboard", () => {
  it("shows the boxes and money, and filters the list", async () => {
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
    expect(summary.getByRole("button", { name: /^2\s*Needed/ })).toHaveAttribute("aria-pressed", "true");
    expect(summary.getByRole("button", { name: /^1\s*Booked\s*Caterer/ })).toBeInTheDocument();
    expect(summary.getByRole("button", { name: /^1\s*Getting quotes\s*1 quote to compare/ })).toBeInTheDocument();
    expect(summary.getByText("₹18,000")).toBeInTheDocument();
    expect(summary.getByText(/Book next:/).parentElement).toHaveTextContent("Entertainer");
    expect(
      summary.getByRole("img", { name: /1 booked, 1 getting quotes, 0 not started, out of 2/ }),
    ).toBeInTheDocument();
    expect(await axe.run(container).then((r) => r.violations.map((v) => v.id))).toEqual([]);

    await user.click(summary.getByRole("button", { name: /^1\s*Booked/ }));
    expect(section.getByText(/^Showing /)).toHaveTextContent("Showing 1 booked");
    expect(section.getAllByText(/^Book (caterer|entertainer)$/i).map((e) => e.textContent)).toEqual(["Book caterer"]);
    expect(summary.getByRole("button", { name: "Booked 1" })).toHaveAttribute("aria-pressed", "true");

    await user.click(summary.getByRole("button", { name: "Not started 0" }));
    expect(section.getByText("No vendors here right now.")).toBeInTheDocument();
    await user.click(section.getByRole("button", { name: "Show all vendors" }));
    expect(section.getByText(/^Showing /)).toHaveTextContent("Showing all 2 vendors");
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
