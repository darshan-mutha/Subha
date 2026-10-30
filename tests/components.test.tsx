// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/EventForm";
import { useState } from "react";
import { TabPanel, ViewTabs } from "@/components/ViewTabs";

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

describe("ViewTabs", () => {
  const items = [
    { id: "a", label: "Guest list" },
    { id: "b", label: "Replies" },
    { id: "c", label: "Seating" },
  ];
  function Views() {
    const [current, setCurrent] = useState("a");
    return (
      <>
        <ViewTabs base="v" label="Guests" className="segmented" items={items} current={current} onSelect={setCurrent} />
        <TabPanel base="v" id={current}>
          <p>{current} panel</p>
        </TabPanel>
      </>
    );
  }

  it("supports arrow keys, Home and End, with one tab stop", () => {
    render(<Views />);
    const [first, second, third] = screen.getAllByRole("tab");
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getAllByRole("tab")[1]).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "End" });
    expect(third).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(third, { key: "ArrowRight" });
    expect(first).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(third).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(third, { key: "Home" });
    expect(first).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(first, { key: "x" });
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("labels the open panel by its tab, which points at it", () => {
    render(<Views />);
    fireEvent.click(screen.getByRole("tab", { name: "Replies" }));
    const panel = screen.getByRole("tabpanel", { name: "Replies" });
    expect(panel).toHaveTextContent("b panel");
    expect(screen.getByRole("tab", { name: "Replies" })).toHaveAttribute("aria-controls", panel.id);
    expect(screen.getByRole("tab", { name: "Guest list" })).not.toHaveAttribute("aria-controls");
  });
});
