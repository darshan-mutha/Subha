// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/EventForm";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { baseInput, samplePlan } from "./fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const data = {
  input: { ...baseInput, focus: ["food" as const], food: "jain" as const, guestNeeds: ["wheelchair" as const] },
  plan: samplePlan,
  timings: null,
  team: [],
  assignments: {},
  done: {},
};

function setup(overrides: Partial<Parameters<typeof PlanWorkspace>[0]> = {}) {
  const props = {
    data,
    planKey: "ui",
    shareUrl: null,
    onChange: vi.fn().mockResolvedValue(undefined),
    onToggle: vi.fn(),
    onShare: null,
    onEdit: null,
    onStartOver: vi.fn(),
    viewer: "",
    onViewerChange: vi.fn(),
    ...overrides,
  };
  const view = render(<PlanWorkspace {...props} />);
  return { props, view };
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Make it yours", () => {
  it("lets the host pick up to three priorities, guest needs and food", async () => {
    const onSubmit = vi.fn();
    render(<EventForm busy={false} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByText(/Make it yours/));
    const group = screen.getByRole("group", { name: /What matters most/ });
    for (const name of ["Food", "Decor", "Photos & video"]) {
      await userEvent.click(within(group).getByRole("checkbox", { name: new RegExp(name.replace("&", "\\&")) }));
    }
    expect(within(group).getByRole("checkbox", { name: /Venue/ })).toBeDisabled();
    await userEvent.click(within(group).getByRole("checkbox", { name: /Decor/ }));
    expect(within(group).getByRole("checkbox", { name: /Venue/ })).toBeEnabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /Wheelchair/ }));
    await userEvent.selectOptions(screen.getByLabelText("Food"), "jain");

    await userEvent.selectOptions(screen.getByLabelText(/Event type/), "birthday");
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: "2027-01-10" } });
    await userEvent.type(screen.getByLabelText(/City/), "Mysuru");
    await userEvent.type(screen.getByLabelText(/Number of guests/), "50");
    await userEvent.type(screen.getByLabelText(/Total budget/), "60000");
    await userEvent.click(screen.getByRole("button", { name: "Create my plan" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ focus: ["food", "photos"], food: "jain", guestNeeds: ["wheelchair"] }),
    );
  });

  it("shows what the plan is shaped around", () => {
    setup();
    const list = screen.getByRole("list", { name: "What this plan is shaped around" });
    expect(within(list).getByText("Matters most: Food")).toBeInTheDocument();
    expect(within(list).getByText("Food: Jain")).toBeInTheDocument();
    expect(within(list).getByText("Wheelchair or step-free access")).toBeInTheDocument();
  });
});

describe("What changed", () => {
  it("shows the changes after an update and can undo them", async () => {
    const updated = { ...data.input, guests: 90, date: "2026-11-28" };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ input: updated, plan: samplePlan, timings: null, changes: ["Guests: 40 → 90", "Cut decor"] }),
        ),
    );
    const { props } = setup();
    await userEvent.click(screen.getByRole("button", { name: /We added 50 guests/ }));
    await userEvent.click(screen.getByRole("button", { name: "Update plan" }));

    const card = await screen.findByRole("region", { name: "What changed" });
    expect(within(card).getByText("Guests: 40 → 90")).toBeInTheDocument();
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({ input: updated }));
    await waitFor(() => expect(card).toHaveFocus());

    await userEvent.click(within(card).getByRole("button", { name: "Undo this change" }));
    expect(props.onChange).toHaveBeenLastCalledWith({ input: data.input, plan: samplePlan, timings: null });
    await waitFor(() => expect(screen.queryByRole("region", { name: "What changed" })).not.toBeInTheDocument());
  });

  it("falls back to a simple line and can be dismissed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ input: data.input, plan: samplePlan, timings: null })));
    setup();
    await userEvent.type(screen.getByLabelText("What would you like to change?"), "Make it greener");
    await userEvent.click(screen.getByRole("button", { name: "Update plan" }));
    const card = await screen.findByRole("region", { name: "What changed" });
    expect(within(card).getByText("Your plan has been updated.")).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("region", { name: "What changed" })).not.toBeInTheDocument();
  });
});

describe("Editable budget", () => {
  it("rebalances the other lines and keeps the total", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    setup({ onChange });
    const input = screen.getByLabelText("Amount for Entertainment in rupees");
    await userEvent.clear(input);
    await userEvent.type(input, "15000{Enter}");
    const saved = onChange.mock.calls.at(-1)?.[0].plan.budget as { category: string; amount: number }[];
    expect(saved.find((l) => l.category === "Entertainment")?.amount).toBe(15000);
    expect(saved.reduce((s, l) => s + l.amount, 0)).toBe(baseInput.budget);
    expect(screen.getByText(/Entertainment up by/)).toBeInTheDocument();
  });

  it("ignores empty or unchanged values", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    setup({ onChange });
    const input = screen.getByLabelText("Amount for Food in rupees");
    await userEvent.clear(input);
    fireEvent.blur(input);
    expect(input).toHaveValue("20,000");
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
});
