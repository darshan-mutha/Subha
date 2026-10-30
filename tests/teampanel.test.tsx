// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamPanel } from "@/components/TeamPanel";
import { planItems } from "@/lib/team";
import { samplePlan } from "./fixtures";

const items = planItems(samplePlan);
const base = {
  items,
  assignments: {},
  done: {},
  eventTitle: "Aarav turns 5",
  busy: false,
  onAutoAssign: vi.fn(),
};

describe("TeamPanel", () => {
  it("adds a person and blocks duplicates", async () => {
    const onTeamChange = vi.fn();
    const { rerender } = render(
      <TeamPanel {...base} team={[]} shareUrl={null} onTeamChange={onTeamChange} onShare={vi.fn()} />,
    );
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument(); // folded until asked for
    await userEvent.click(screen.getByRole("button", { name: "Add family & friends" }));
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
    await userEvent.type(screen.getByLabelText("Name"), "Ravi");
    await userEvent.type(screen.getByLabelText(/Role/), "cousin");
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(onTeamChange.mock.calls[0][0][0]).toMatchObject({ name: "Ravi", role: "cousin" });

    const team = onTeamChange.mock.calls[0][0];
    rerender(<TeamPanel {...base} team={team} shareUrl={null} onTeamChange={onTeamChange} onShare={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Name"), "ravi");
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/already in the team/);
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("marks only the box that has the problem", async () => {
    const onTeamChange = vi.fn();
    render(<TeamPanel {...base} team={[]} shareUrl={null} onTeamChange={onTeamChange} onShare={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Add family & friends" }));
    const name = screen.getByLabelText("Name");
    const role = screen.getByLabelText(/Role/);

    await userEvent.type(name, "Ravi");
    await userEvent.type(role, "<script>");
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Role contains characters/);
    expect(role).toHaveAttribute("aria-invalid", "true");
    expect(role).toHaveAttribute("aria-describedby", alert.id);
    expect(name).not.toHaveAttribute("aria-invalid");

    await userEvent.clear(name);
    await userEvent.clear(role);
    await userEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Please enter a name/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(role).not.toHaveAttribute("aria-invalid");
    expect(onTeamChange).not.toHaveBeenCalled();
  });

  it("shows progress, per-person counts and WhatsApp links once shared", () => {
    const team = [{ id: "mravi", name: "Ravi", role: "" }];
    const assignments = { [items[0].id]: "mravi", [items[1].id]: "mravi" };
    render(
      <TeamPanel
        {...base}
        team={team}
        assignments={assignments}
        done={{ [items[0].id]: true }}
        shareUrl="https://shuba.example/p/abc"
        onTeamChange={vi.fn()}
        onShare={null}
      />,
    );
    expect(screen.getByText(/1 of 5/)).toBeInTheDocument();
    expect(screen.getByText("2 tasks, 1 done")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Send tasks to Ravi on WhatsApp/ });
    expect(link.getAttribute("href")).toContain("wa.me");
    expect(screen.getByText("https://shuba.example/p/abc")).toBeInTheDocument();
  });

  it("offers sharing before a link exists", async () => {
    const onShare = vi.fn();
    render(<TeamPanel {...base} team={[]} shareUrl={null} onTeamChange={vi.fn()} onShare={onShare} />);
    await userEvent.click(screen.getByRole("button", { name: "Share this plan with my team" }));
    expect(onShare).toHaveBeenCalled();
  });
});
