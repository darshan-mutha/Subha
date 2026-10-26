// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection } from "./nav";

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
    const home = within(currentSection());
    expect(currentSection()).toHaveAttribute("aria-label", "Home");
    expect(home.getByRole("heading", { name: "Do next" })).toBeInTheDocument();
    expect(home.getByRole("heading", { name: "Change your plan" })).toBeInTheDocument();
    expect(home.getByText(samplePlan.summary)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Plan together" })).not.toBeInTheDocument();
    // The header carries no buttons any more: actions live in the menu.
    expect(screen.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
  });

  it("shows the essential sections on the bar and the rest in the ☰ menu", async () => {
    const user = userEvent.setup();
    const { props, view } = setup();
    const nav = within(screen.getByRole("navigation", { name: "Plan sections" }));
    const bar = nav.getAllByRole("button").map((b) => b.textContent);
    expect(bar).toEqual(["Home", "Budget", "Tasks", "Guests", "Menu"]);
    expect(nav.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");

    await user.click(nav.getByRole("button", { name: "Tasks" }));
    expect(currentSection()).toHaveAttribute("aria-label", "Timeline");
    expect(currentSection()).toHaveFocus();
    expect(nav.getByRole("button", { name: "Tasks" })).toHaveAttribute("aria-current", "page");

    const menu = nav.getByRole("button", { name: "Menu" });
    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(nav.getByRole("button", { name: "Ideas" })).toHaveFocus();
    expect(
      [
        "Vendors",
        "Invite",
        "Team",
        "Ideas",
        "Edit details",
        "Download PDF / Print",
        "My events (2)",
        "Plan a new event",
      ].every((name) => nav.queryByRole("button", { name })),
    ).toBe(true);
    expect(await axe.run(view.container).then((r) => r.violations.map((v) => v.id))).toEqual([]);

    await user.click(nav.getByRole("button", { name: "Team" }));
    expect(currentSection()).toHaveAttribute("aria-label", "Team");
    expect(menu).toHaveAttribute("aria-current", "page");
    expect(nav.queryByRole("button", { name: "Vendors" })).not.toBeInTheDocument();

    await user.click(menu);
    await user.keyboard("{Escape}");
    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute("aria-expanded", "false");

    await user.click(menu);
    await user.click(nav.getByRole("button", { name: "Edit details" }));
    expect(props.onEdit).toHaveBeenCalled();
    await user.click(menu);
    await user.click(document.body);
    expect(nav.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
  });
});
