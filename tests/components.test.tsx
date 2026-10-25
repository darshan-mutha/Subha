// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/EventForm";
import { Tabs } from "@/components/Tabs";

describe("EventForm", () => {
  it("shows accessible errors when submitted empty", async () => {
    const onSubmit = vi.fn();
    render(<EventForm busy={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Create my plan" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Please fix/);
    const city = screen.getByLabelText(/City/);
    expect(city).toHaveAttribute("aria-invalid", "true");
    expect(city).toHaveAccessibleDescription("Please enter a city");
  });

  it("fills an example and submits clean data", async () => {
    const onSubmit = vi.fn();
    render(<EventForm busy={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Kid's birthday" }));
    await userEvent.click(screen.getByRole("button", { name: "Create my plan" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ eventType: "birthday", guests: 40, budget: 50000 });
  });

  it("turns on auspicious timings for traditional events", async () => {
    render(<EventForm busy={false} onSubmit={vi.fn()} />);
    const toggle = screen.getByRole("checkbox", { name: /auspicious timings/ });
    expect(toggle).not.toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText(/Event type/), "housewarming");
    expect(toggle).toBeChecked();
  });

  it("disables the button while planning", () => {
    render(<EventForm busy onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Creating your plan/ })).toBeDisabled();
  });
});

describe("Tabs", () => {
  const items = [
    { id: "a", label: "Budget", content: <p>Budget panel</p> },
    { id: "b", label: "Timeline", content: <p>Timeline panel</p> },
    { id: "c", label: "Vendors", content: <p>Vendors panel</p> },
  ];

  it("supports arrow keys, Home and End", () => {
    render(<Tabs items={items} label="Plan sections" />);
    const [first, second, third] = screen.getAllByRole("tab");
    expect(first).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "End" });
    expect(third).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(third, { key: "ArrowRight" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Budget panel");
  });
});
