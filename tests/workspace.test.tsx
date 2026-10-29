// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { SharedPlanView } from "@/components/SharedPlanView";
import { Planner } from "@/components/Planner";
import { ClientOnly } from "@/components/ClientOnly";
import { savePlan } from "@/lib/client";
import { planItems } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection, menuAction, openSection } from "./nav";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const timings = {
  location: "Bengaluru",
  date: "2026-12-12",
  weekday: "Saturday",
  sunrise: "6:30 AM",
  sunset: "5:50 PM",
  rahuKalam: { start: "9:20 AM", end: "10:45 AM" },
  yamagandam: { start: "1:35 PM", end: "3:00 PM" },
  gulikaKalam: { start: "6:30 AM", end: "7:55 AM" },
  betterWindows: [{ start: "7:55 AM", end: "9:20 AM" }],
};
const team = [
  { id: "mravi", name: "Ravi", role: "cousin" },
  { id: "mmeena", name: "Meena", role: "" },
];
const items = planItems(samplePlan);
const data = {
  input: baseInput,
  plan: { ...samplePlan, warnings: ["Book the magician early"] },
  timings,
  team,
  assignments: { [items[0].id]: "mravi", [items[3].id]: "mmeena" },
  done: { [items[0].id]: true },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function setup(overrides: Partial<Parameters<typeof PlanWorkspace>[0]> = {}) {
  const props = {
    data,
    planKey: "test",
    shareUrl: null,
    onChange: vi.fn().mockResolvedValue(undefined),
    onToggle: vi.fn(),
    onShare: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onStartOver: vi.fn(),
    viewer: "",
    onViewerChange: vi.fn(),
    ...overrides,
  };
  render(<PlanWorkspace {...props} />);
  return props;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  push.mockReset();
});

describe("PlanWorkspace", () => {
  it("shows the summary, warnings and every section", async () => {
    setup();
    expect(screen.getByRole("heading", { name: "Aarav turns 5" })).toHaveFocus();
    expect(within(screen.getByRole("list", { name: "Event details" })).getByText("₹50,000")).toBeInTheDocument();
    expect(screen.getByText("Book the magician early")).toBeInTheDocument();
    for (const tab of ["Budget", "Timeline", "Vendors", "Ideas", "Timings"]) {
      await openSection(tab);
      expect(currentSection()).toBeVisible();
    }
    expect(screen.getByText("Rahu Kalam")).toBeInTheDocument();
  });

  it("ticks tasks and changes owners", async () => {
    const props = setup();
    await openSection("Timeline");
    const panel = currentSection();
    const first = within(panel).getByRole("checkbox", { name: "Send invites" });
    expect(first).toBeChecked();
    await userEvent.click(first);
    expect(props.onToggle).toHaveBeenCalledWith(items[0].id, false);
    await userEvent.selectOptions(within(panel).getByLabelText("Who will do this: Confirm magician"), "mmeena");
    expect(props.onChange).toHaveBeenCalledWith({ assignments: expect.objectContaining({ [items[1].id]: "mmeena" }) });
    await userEvent.selectOptions(within(panel).getByLabelText("Who will do this: Send invites"), "");
    expect(props.onChange).toHaveBeenLastCalledWith({
      assignments: expect.not.objectContaining({ [items[0].id]: expect.anything() }),
    });
  });

  it("filters tasks by person", async () => {
    setup({ viewer: "mmeena" });
    await openSection("Timeline");
    expect(screen.getByText("No tasks for this person yet.")).toBeInTheDocument();
    await openSection("Vendors");
    const panel = currentSection();
    expect(within(panel).getByText("Book caterer")).toBeInTheDocument();
    expect(within(panel).queryByText("Book entertainer")).not.toBeInTheDocument();
  });

  it("refines the plan with a change request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ input: { ...baseInput, budget: 40000 }, plan: samplePlan, timings: null })),
    );
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: "Reduce the budget by 20%" }));
    await userEvent.click(screen.getByRole("button", { name: "Update plan" }));
    await waitFor(() =>
      expect(props.onChange).toHaveBeenCalledWith(
        expect.objectContaining({ input: expect.objectContaining({ budget: 40000 }) }),
      ),
    );
    expect(screen.getByLabelText("What would you like to change?")).toHaveValue("");
  });

  it("shows a friendly error when refining fails or the request is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "The AI service is busy right now." }, 502)));
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Update plan" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/describe what you want to change/);
    await userEvent.type(screen.getByLabelText("What would you like to change?"), "Make it eco-friendly");
    await userEvent.click(screen.getByRole("button", { name: "Update plan" }));
    expect(await screen.findByText(/busy right now/)).toBeInTheDocument();
  });

  it("lets AI divide the tasks and removes people", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ assignments: { [items[2].id]: "mravi" } })));
    const props = setup();
    await openSection("Team");
    await userEvent.click(screen.getByRole("button", { name: /divide the tasks/ }));
    await waitFor(() => expect(props.onChange).toHaveBeenCalledWith({ assignments: { [items[2].id]: "mravi" } }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Meena" }));
    expect(props.onChange).toHaveBeenLastCalledWith({ team: [team[0]], assignments: { [items[0].id]: "mravi" } });
  });

  it("runs the header actions", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const props = setup();
    await menuAction("Edit details");
    await menuAction("Download PDF / Print");
    await menuAction("Plan a new event");
    await openSection("Team");
    await userEvent.click(screen.getByRole("button", { name: "Share this plan with my team" }));
    expect(props.onEdit).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
    expect(props.onStartOver).toHaveBeenCalled();
    expect(props.onShare).toHaveBeenCalled();
  });

  it("copies a vendor message", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup();
    await openSection("Vendors");
    fireEvent.click(screen.getAllByText(/Ready-to-send message/)[0]);
    await userEvent.click(screen.getAllByRole("button", { name: "Copy message" })[0]);
    expect(writeText).toHaveBeenCalledWith(samplePlan.vendors[0].brief);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});

describe("Do next", () => {
  it("lists the most urgent unfinished tasks with owners, priority and due date", async () => {
    const props = setup();
    const section = screen.getByRole("region", { name: "Do next" });
    const rows = within(section).getAllByRole("checkbox");
    expect(rows.length).toBeGreaterThan(0);
    expect(within(section).queryByRole("checkbox", { name: "Send invites" })).not.toBeInTheDocument(); // already done
    expect(within(section).getAllByText(/Priority:/).length).toBe(rows.length);
    expect(within(section).getAllByText(/^(By|Due|Overdue)/).length).toBe(rows.length);
    expect(within(section).getByText("Meena")).toBeInTheDocument();
    await userEvent.click(rows[0]);
    expect(props.onToggle).toHaveBeenCalledWith(expect.stringMatching(/^[tv]_/), true);
  });

  it("shows one person's next tasks and an all-clear message", () => {
    // Meena owns only the caterer booking; once that is done she is all caught up.
    setup({ viewer: "mmeena", data: { ...data, done: { [items[3].id]: true } } });
    expect(screen.getByRole("region", { name: "Do next · Meena" })).toHaveTextContent(/all caught up/);
  });
});

describe("Comes alive", () => {
  const allDone = Object.fromEntries(items.map((i) => [i.id, true]));

  afterEach(() => document.documentElement.style.removeProperty("--alive"));

  it("starts in black and white and sets colour from progress", () => {
    setup({ data: { ...data, done: {} } });
    expect(document.documentElement.style.getPropertyValue("--alive")).toBe("0.000");
    expect(screen.getByText(/^0% done/)).toBeInTheDocument();
  });

  it("grows colour with each tick, easing so it shows early", () => {
    setup({ data: { ...data, done: { [items[0].id]: true } } });
    expect(screen.getByText(/^20% done · 1 of 2 milestones/)).toBeInTheDocument();
    expect(Number(document.documentElement.style.getPropertyValue("--alive"))).toBeCloseTo(0.36, 2);
  });

  it("celebrates when everything is done", () => {
    setup({ data: { ...data, done: allDone } });
    expect(screen.getByRole("heading", { name: "All set for Aarav turns 5!" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Do next/ })).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--alive")).toBe("1.000");
  });

  it("plays a milestone moment once, then remembers it", async () => {
    localStorage.setItem("shuba:blooms:bloom-test", JSON.stringify([]));
    const { onToggle } = setup({ planKey: "bloom-test", data: { ...data, done: { [items[0].id]: true } } });
    expect(onToggle).not.toHaveBeenCalled();
    const message = screen.getByText(/^Send invites: done\. /);
    const bloom = message.closest("[role=status]") as HTMLElement;
    expect(bloom).toBeInTheDocument();
    await userEvent.click(within(bloom).getByRole("button", { name: "Close" }));
    expect(screen.queryByText(/^Send invites: done/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("shuba:blooms:bloom-test")!)).toEqual([items[0].id]);
  });

  it("does not replay milestones that were already done on first view", () => {
    setup({ planKey: "fresh-view", data: { ...data, done: { [items[0].id]: true } } });
    expect(screen.queryByText(/^Send invites: done/)).not.toBeInTheDocument();
  });
});

describe("SharedPlanView", () => {
  const shared = { ...data, id: "A".repeat(22), version: 1, updatedAt: "2026-10-24T00:00:00Z" };

  it("loads the shared plan and saves ticks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(shared))
      .mockResolvedValueOnce(json({ done: { [items[1].id]: true } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SharedPlanView id={shared.id} />);
    expect(await screen.findByRole("heading", { name: "Aarav turns 5" })).toBeInTheDocument();
    expect(screen.getByText(`${window.location.origin}/p/${shared.id}`)).toBeInTheDocument();
    await openSection("Timeline");
    await userEvent.click(within(currentSection()).getByRole("checkbox", { name: "Confirm magician" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/plans/${shared.id}/progress`, expect.anything()));
  });

  it("saves plan changes with the current version", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(shared))
      .mockResolvedValueOnce(json({ ...shared, version: 2, team: [team[0]] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SharedPlanView id={shared.id} />);
    await screen.findByRole("heading", { name: "Aarav turns 5" });
    await openSection("Team");
    await userEvent.click(screen.getByRole("button", { name: "Remove Meena" }));
    await waitFor(() => expect(screen.getByText("All changes saved")).toBeInTheDocument());
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.version).toBe(1);
    expect(body.content.team).toHaveLength(1);
  });

  it("undoes a tick that could not be saved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(shared)).mockRejectedValueOnce(new Error("offline")));
    render(<SharedPlanView id={shared.id} />);
    await screen.findByRole("heading", { name: "Aarav turns 5" });
    await openSection("Timeline");
    const box = within(currentSection()).getByRole("checkbox", { name: "Confirm magician" });
    await userEvent.click(box);
    await waitFor(() => expect(box).not.toBeChecked());
    expect(screen.getByText(/Could not save that tick/)).toBeInTheDocument();
  });

  it("explains a broken link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ error: "This plan could not be found. The link may be wrong." }, 404)),
    );
    render(<SharedPlanView id="bad" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be found/);
    expect(screen.getByRole("link", { name: "Plan a new event" })).toHaveAttribute("href", "/");
  });
});

describe("Planner", () => {
  it("reopens a plan saved in this browser and shares it", async () => {
    savePlan({ ...data, timings: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ id: "B".repeat(22) })));
    render(<Planner />);
    expect(screen.getByRole("heading", { name: "Aarav turns 5" })).toBeInTheDocument();
    await openSection("Timeline");
    await userEvent.click(within(currentSection()).getByRole("checkbox", { name: "Confirm magician" }));
    expect(within(currentSection()).getByRole("checkbox", { name: "Confirm magician" })).toBeChecked();
    await openSection("Team");
    await userEvent.click(screen.getByRole("button", { name: "Share this plan with my team" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/p/${"B".repeat(22)}?new=1`));
  });

  it("creates a plan from the form and can start over", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ input: baseInput, plan: samplePlan, timings: null })));
    render(<Planner />);
    await userEvent.click(screen.getByRole("button", { name: /Fill in the details yourself/ }));
    await userEvent.click(screen.getByRole("button", { name: "Kid's birthday" }));
    await userEvent.click(screen.getByRole("button", { name: "Create my plan" }));
    expect(await screen.findByRole("heading", { name: "Aarav turns 5" })).toBeInTheDocument();
    await menuAction("Edit details");
    expect(screen.getByRole("heading", { name: "Edit your event" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /go back to my plan/ }));
    await menuAction("Plan a new event");
    expect(screen.getByRole("heading", { name: "Tell us about your celebration" })).toBeInTheDocument();
  });

  it("shows server errors on the form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "The AI service is busy right now." }, 502)));
    render(<Planner />);
    await userEvent.click(screen.getByRole("button", { name: /Fill in the details yourself/ }));
    await userEvent.click(screen.getByRole("button", { name: "Kid's birthday" }));
    await userEvent.click(screen.getByRole("button", { name: "Create my plan" }));
    expect(await screen.findByText(/busy right now/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Type or speak instead" }));
    expect(screen.getByLabelText(/Describe your event/)).toBeInTheDocument();
  });

  it("reports when nothing could be understood", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ transcript: "", values: {}, missing: ["eventType", "date", "city", "guests", "budget"] }),
        ),
    );
    render(<Planner />);
    await userEvent.type(screen.getByLabelText(/Describe your event/), "something something");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not catch any details/);
  });
});

describe("ClientOnly", () => {
  it("renders children in the browser", async () => {
    await act(async () => {
      render(<ClientOnly fallback={<p>loading</p>}>ready</ClientOnly>);
    });
    expect(screen.getByText("ready")).toBeInTheDocument();
  });
});
