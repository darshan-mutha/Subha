// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import type { SharedPlanContent } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

function setup() {
  let data = { input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {}, done: {}, shifts: {} };
  const onChange = vi.fn(async (content: Partial<SharedPlanContent>) => {
    data = { ...data, ...content } as typeof data;
    view.rerender(<PlanWorkspace {...props()} />);
  });
  const props = () => ({
    data,
    planKey: "delay",
    shareUrl: null,
    onChange,
    onToggle: vi.fn(),
    onShare: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onStartOver: vi.fn(),
    viewer: "",
    onViewerChange: vi.fn(),
  });
  const view = render(<PlanWorkspace {...props()} />);
  return { onChange, view };
}

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

function openTab(name: string) {
  fireEvent.click(screen.getByRole("tab", { name }));
  return within(screen.getByRole("tabpanel"));
}

describe("Running late", () => {
  it("moves a late booking and the tasks after it, then undoes", async () => {
    const { onChange } = setup();
    const vendors = openTab("Vendors");
    fireEvent.click(vendors.getByRole("button", { name: "Running late? Book caterer" }));
    const panel = screen.getByRole("group", { name: /When will “Book caterer” be done\?/ });
    const select = within(panel).getByRole("combobox");
    expect(select).toHaveFocus();
    expect(
      within(panel)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["By 15 Nov (3 days later)", "By 19 Nov (7 days later)", "By 26 Nov (14 days later)"]);
    fireEvent.change(select, { target: { value: "1" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Move it and later tasks" }));
    await vi.waitFor(() => expect(screen.getByRole("heading", { name: "What changed" })).toBeInTheDocument());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("“Book caterer” moved to 19 Nov (was 12 Nov).")).toBeInTheDocument();
    expect(screen.getByText(/2 later tasks moved with it/)).toBeInTheDocument();
    expect(screen.getAllByText("Moved 1 week later").length).toBeGreaterThan(0);

    expect(openTab("Timeline").getByText("By 21 Nov")).toBeInTheDocument(); // invites, was 14 Nov

    fireEvent.click(screen.getByRole("button", { name: "Undo this change" }));
    await vi.waitFor(() => expect(screen.queryByRole("heading", { name: "What changed" })).toBeNull());
    expect(onChange).toHaveBeenLastCalledWith({ shifts: {} });
    expect(screen.queryByText("Moved 1 week later")).toBeNull();
  });

  it("does not offer it on the event day, closes with Escape and has no accessibility issues", async () => {
    const { view } = setup();
    const timeline = openTab("Timeline");
    expect(screen.queryByRole("button", { name: /Running late\? Set up decor/ })).toBeNull();
    const toggle = timeline.getByRole("button", { name: "Running late? Send invites" });
    fireEvent.click(toggle);
    const panel = timeline.getByRole("group", { name: /When will “Send invites” be done/ });
    expect(await violations(view.container)).toEqual([]);
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(timeline.queryByRole("group", { name: /When will/ })).toBeNull();
    expect(timeline.getByRole("button", { name: "Running late? Send invites" })).toHaveFocus();
  });
});
