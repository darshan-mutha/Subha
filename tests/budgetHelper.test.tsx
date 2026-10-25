// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/EventForm";

describe("Not sure? Help me decide", () => {
  it("asks for event type and guests first", async () => {
    render(<EventForm busy={false} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Not sure? Help me decide" }));
    expect(screen.getByText(/suggest\s+three budgets/)).toBeInTheDocument();
  });

  it("shows three levels and fills the budget when one is picked", async () => {
    const onSubmit = vi.fn();
    render(<EventForm busy={false} onSubmit={onSubmit} />);
    await userEvent.selectOptions(screen.getByLabelText(/Event type/), "birthday");
    await userEvent.type(screen.getByLabelText(/Number of guests/), "40");
    await userEvent.type(screen.getByLabelText(/City/), "Bengaluru");
    const toggle = screen.getByRole("button", { name: "Not sure? Help me decide" });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const panel = screen.getByRole("region", { name: /Pick a level/ });
    expect(within(panel).getByText(/Rough estimates only/)).toBeInTheDocument();
    expect(
      within(panel)
        .getAllByRole("heading", { level: 4 })
        .map((h) => h.textContent),
    ).toEqual(["Simple", "Comfortable", "Grand"]);

    await userEvent.click(within(panel).getByRole("button", { name: /^Use .*\(Comfortable\)$/ }));
    const budget = screen.getByLabelText(/Total budget/);
    expect(budget).toHaveFocus();
    expect(Number((budget as HTMLInputElement).value)).toBeGreaterThan(0);
    expect(screen.queryByRole("region", { name: /Pick a level/ })).not.toBeInTheDocument();
    expect(screen.getByText(/per guest/)).toBeInTheDocument();
    expect(screen.getByText(/Comfortable budget of .* added/)).toBeInTheDocument();
  });

  it("closes and returns focus to the toggle", async () => {
    render(<EventForm busy={false} onSubmit={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Not sure? Help me decide" });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("marks the chosen level when reopened", async () => {
    render(<EventForm busy={false} onSubmit={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText(/Event type/), "wedding");
    await userEvent.type(screen.getByLabelText(/Number of guests/), "200");
    await userEvent.click(screen.getByRole("button", { name: "Not sure? Help me decide" }));
    await userEvent.click(screen.getByRole("button", { name: /^Use .*\(Simple\)$/ }));
    await userEvent.click(screen.getByRole("button", { name: "Not sure? Help me decide" }));
    expect(screen.getByRole("button", { name: /^Use .*\(Simple\)$/ })).toHaveAttribute("aria-pressed", "true");
  });
});
