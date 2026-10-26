// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { baseInput, samplePlan } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function setup() {
  const props = {
    data: { input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {}, done: {} },
    planKey: "nav",
    shareUrl: null,
    onChange: vi.fn().mockResolvedValue(undefined),
    onToggle: vi.fn(),
    onShare: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onStartOver: vi.fn(),
    onMyEvents: vi.fn(),
    eventCount: 2,
    viewer: "",
    onViewerChange: vi.fn(),
  };
  const view = render(<PlanWorkspace {...props} />);
  return { props, view };
}

describe("Plan navigation", () => {
  it("opens Home first, with Do next and the change box, and keeps other sections apart", () => {
    setup();
    expect(screen.getByRole("tab", { name: "Home" })).toHaveAttribute("aria-selected", "true");
    const home = within(screen.getByRole("tabpanel"));
    expect(home.getByRole("heading", { name: "Do next" })).toBeInTheDocument();
    expect(home.getByRole("heading", { name: "Change your plan" })).toBeInTheDocument();
    expect(home.getByText(samplePlan.summary)).toBeInTheDocument();
    expect(home.queryByRole("heading", { name: "Plan together" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Home",
      "Budget",
      "Timeline",
      "Vendors",
      "Guests",
      "Invite",
      "Team",
      "Ideas",
    ]);
  });

  it("phone bar switches sections, and More lists the rest and the page actions", async () => {
    const user = userEvent.setup();
    const { props, view } = setup();
    const bar = within(screen.getByRole("navigation", { name: "Plan sections (phone)" }));
    expect(bar.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");

    await user.click(bar.getByRole("button", { name: "Tasks" }));
    expect(screen.getByRole("tab", { name: "Timeline" })).toHaveAttribute("aria-selected", "true");
    expect(bar.getByRole("button", { name: "Tasks" })).toHaveAttribute("aria-current", "page");

    const more = bar.getByRole("button", { name: "More" });
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(bar.getByRole("button", { name: "Vendors" })).toHaveFocus();
    expect(await axe.run(view.container).then((r) => r.violations.map((v) => v.id))).toEqual([]);
    await user.click(bar.getByRole("button", { name: "Team" }));
    expect(screen.getByRole("tab", { name: "Team" })).toHaveAttribute("aria-selected", "true");
    expect(more).toHaveAttribute("aria-current", "page");
    expect(bar.queryByRole("button", { name: "Vendors" })).not.toBeInTheDocument();

    await user.click(more);
    await user.keyboard("{Escape}");
    expect(more).toHaveFocus();
    expect(more).toHaveAttribute("aria-expanded", "false");

    await user.click(more);
    await user.click(bar.getByRole("button", { name: "My events (2)" }));
    expect(props.onMyEvents).toHaveBeenCalled();
    await user.click(more);
    await user.click(document.body);
    expect(bar.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
  });
});
