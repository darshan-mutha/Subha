// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import type { LocalWorkspace } from "@/lib/client";
import { planStructure, type SharedPlanContent } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

const catererId = planStructure(samplePlan).vendors[0].id;

/** Caterer booked at ₹26,000 against a ₹20,000 food line: ₹6,000 over. */
const overBooked: LocalWorkspace = {
  input: baseInput,
  plan: samplePlan,
  timings: null,
  team: [],
  assignments: {},
  done: { [catererId]: true },
  deals: {
    [catererId]: {
      quotes: [{ id: "qa1", vendorName: "Annapoorna", phone: "", amount: 26000, includes: "" }],
      booked: "qa1",
      advance: 0,
      budgetCategory: "Food",
      agreement: "",
    },
  },
};

const options = [
  {
    kind: "raise-budget",
    title: "Increase the budget to ₹56,000",
    detail: "Add ₹6,000 so your bookings fit.",
    saving: 6000,
    affects: "You spend ₹6,000 more in total.",
    instruction: "",
  },
  {
    kind: "cheaper-options",
    title: "Home baker for the cake",
    detail: "Order the cake from a home baker.",
    saving: 2500,
    affects: "Fewer cake designs.",
    instruction: "Order the cake from a home baker. Keep the total budget the same and move the money saved to Food.",
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The workspace as last saved by the screen, for checking what changed. */
const saved: { data: LocalWorkspace } = { data: overBooked };
function Harness({ initial }: { initial: LocalWorkspace }) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    saved.data = data;
  }, [data]);
  return (
    <PlanWorkspace
      planKey="savings"
      data={data}
      shareUrl={null}
      onChange={async (c: Partial<SharedPlanContent>) => setData((d) => ({ ...d, ...c }))}
      onToggle={vi.fn()}
      onShare={null}
      onEdit={null}
      onStartOver={vi.fn()}
      viewer=""
      onViewerChange={vi.fn()}
    />
  );
}

afterEach(() => vi.unstubAllGlobals());

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("Over budget choices", () => {
  it("flags the overspend, opens the choices and raises the budget with Undo", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(json({ options, source: "ai" }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Harness initial={overBooked} />);

    expect(screen.getByRole("heading", { name: /Bookings are ₹6,000 over budget/ })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Ideas" }));
    await user.click(screen.getByRole("button", { name: "See my choices" }));
    expect(screen.getByRole("tab", { name: "Budget" })).toHaveAttribute("aria-selected", "true");
    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByRole("heading", { name: "Over budget? See your choices" })).toBeInTheDocument();
    expect(panel.getByText(/Food \(₹6,000\)/)).toBeInTheDocument();

    await user.click(panel.getByRole("button", { name: "Show my choices" }));
    await panel.findByRole("heading", { name: "Home baker for the cake" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/savings");
    expect(body).toMatchObject({ mode: "cover", need: 6000, overLines: [{ category: "Food", over: 6000 }] });
    expect(panel.getByText("Adds ₹6,000")).toBeInTheDocument();
    expect(panel.getByText("Saves about ₹2,500")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    await user.click(panel.getByRole("button", { name: "Choose: Increase the budget to ₹56,000" }));
    const changed = await screen.findByRole("heading", { name: "What changed" });
    expect(changed.closest("section")).toHaveTextContent("Total budget: ₹50,000 → ₹56,000");
    expect(saved.data.input.budget).toBe(56000);
    expect(saved.data.plan.budget.find((l) => l.category === "Food")?.amount).toBe(26000);
    expect(screen.queryByRole("heading", { name: /over budget/ })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce(); // raising the budget needs no AI

    await user.click(screen.getByRole("button", { name: "Undo this change" }));
    await waitFor(() => expect(saved.data.input.budget).toBe(50000));
    expect(screen.getByRole("heading", { name: /Bookings are ₹6,000 over budget/ })).toBeInTheDocument();
  });

  it("applies an AI choice through the change flow", async () => {
    const user = userEvent.setup();
    const refined = { input: baseInput, plan: samplePlan, timings: null, changes: ["Cake from a home baker"] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ options, source: "ai" }))
      .mockResolvedValueOnce(json(refined));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness initial={overBooked} />);
    await user.click(screen.getByRole("tab", { name: "Budget" }));
    const panel = within(screen.getByRole("tabpanel"));
    await user.click(panel.getByRole("button", { name: "Show my choices" }));
    await user.click(await panel.findByRole("button", { name: "Choose: Home baker for the cake" }));
    await screen.findByText("Cake from a home baker");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/refine");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).instruction).toBe(options[1].instruction);
  });

  it("asks how much to save when nothing is over, and checks the amount", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(json({ options: options.slice(1), source: "standard" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness initial={{ ...overBooked, deals: {} }} />);
    expect(screen.queryByRole("button", { name: "See my choices" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Budget" }));
    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByRole("heading", { name: "Need to spend less?" })).toBeInTheDocument();
    const amount = panel.getByLabelText("How much do you need to save?");

    await user.click(panel.getByRole("button", { name: "Show my choices" }));
    expect(panel.getByRole("alert")).toHaveTextContent("at least ₹100");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    await user.type(amount, "90000");
    await user.click(panel.getByRole("button", { name: "Show my choices" }));
    expect(panel.getByRole("alert")).toHaveTextContent("more than your whole budget");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.clear(amount);
    await user.type(amount, "₹10,000");
    await user.click(panel.getByRole("button", { name: "Show my choices" }));
    await panel.findByText(/standard suggestions/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ mode: "cut", need: 10000 });
  });
});
