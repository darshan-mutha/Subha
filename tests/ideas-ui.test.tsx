// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/EventForm";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import type { LocalWorkspace } from "@/lib/client";
import type { EventInput, Plan } from "@/lib/schemas";
import type { SharedPlanContent } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection, openSection } from "./nav";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const saved: Partial<SharedPlanContent>[] = [];

function Harness({ initial }: { initial: LocalWorkspace }) {
  const [data, setData] = useState(initial);
  return (
    <PlanWorkspace
      planKey="ideas"
      data={data}
      shareUrl={null}
      onChange={async (c: Partial<SharedPlanContent>) => {
        saved.push(c);
        setData((d) => ({ ...d, ...c }));
      }}
      onToggle={vi.fn()}
      onShare={null}
      onEdit={null}
      onStartOver={vi.fn()}
      viewer=""
      onViewerChange={vi.fn()}
    />
  );
}

const weddingPlan: Plan = {
  ...samplePlan,
  functions: [
    {
      name: "Mehendi",
      day: 1,
      time: "Afternoon",
      guests: 80,
      amount: 20000,
      mood: "Green and playful",
      rituals: ["Bride's henna"],
      needs: ["Henna artist"],
    },
    {
      name: "Muhurtham",
      day: 2,
      time: "Morning",
      guests: 300,
      amount: 29000,
      mood: "Calm and sacred",
      rituals: ["Kanyadaanam", "Mangalya dharanam"],
      needs: ["Priest", "Thali"],
    },
  ],
};

const start = (plan: Plan = samplePlan, input: EventInput = baseInput): LocalWorkspace => ({
  input,
  plan,
  timings: null,
  team: [],
  assignments: {},
  done: {},
});

const direction = (name: string, fit = "fits") => ({
  name,
  mood: `${name} mood`,
  colors: [
    { name: "Marigold", hex: "#E8A317" },
    { name: "Leaf green", hex: "#2E7D4F" },
  ],
  decor: "Leafy arches",
  food: "Fruit cups",
  fun: "Animal masks",
  signature: { title: `${name} parade`, detail: "Kids parade in masks." },
  fit,
});

const newIdea = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  detail: `${title} detail`,
  why: "Because Aarav loves animals",
  moment: "fun",
  forFunction: "",
  cost: 1000,
  effort: "help",
  ...extra,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  saved.length = 0;
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.mode === "themes")
      return json({ mode: "themes", directions: [direction("Jungle Parade"), direction("Starry Safari", "stretch")] });
    if (body.mode === "ideas")
      return json({
        mode: "ideas",
        signature: { title: "Jungle parade", detail: "Kids parade in masks." },
        items: [newIdea("Vine entrance", { moment: "arrival" }), newIdea("Mask-making table")],
      });
    return json({ mode: "more", signature: null, items: [newIdea("Mini zoo corner"), newIdea("Safari hats")] });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ideas section", () => {
  it("starts from the heart, offers three themes and applies the chosen one", async () => {
    const user = userEvent.setup();
    render(<Harness initial={start()} />);
    await openSection("Ideas");
    const ideas = currentSection();

    await user.type(within(ideas).getByLabelText("Who is it really for?"), "Aarav’s 5th");
    await user.click(within(ideas).getByLabelText("Fun"));
    await user.click(within(ideas).getByRole("button", { name: "Show me 3 theme ideas" }));

    expect(await within(ideas).findByRole("heading", { name: /Three directions/ })).toHaveFocus();
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sent.heart).toEqual({ forWhom: "Aarav's 5th", feelings: ["fun"], own: "" });
    expect(within(ideas).getByText("Stretches your budget")).toBeInTheDocument();
    expect(saved.at(-1)?.ideaState?.directions).toHaveLength(2);

    await user.click(within(ideas).getByRole("button", { name: "Choose Starry Safari" }));
    expect(await within(ideas).findByRole("heading", { name: "Vine entrance" })).toBeInTheDocument();
    const plan = saved.at(-1)?.plan;
    expect(plan?.theme).toMatchObject({ name: "Starry Safari", swatches: ["#E8A317", "#2E7D4F"] });
    expect(plan?.ideas.signature?.title).toBe("Jungle parade");
    expect(within(ideas).getByText("Your theme")).toBeInTheDocument();
    expect(within(ideas).getByRole("heading", { name: "Arrival" })).toBeInTheDocument();
    expect(within(ideas).getAllByText("New").length).toBe(2);
  });

  it("builds on the host's own idea and asks for something to start from", async () => {
    const user = userEvent.setup();
    render(<Harness initial={start()} />);
    await openSection("Ideas");
    const ideas = currentSection();

    await user.click(within(ideas).getByRole("button", { name: "Get ideas" }));
    expect(within(ideas).getByRole("alert")).toHaveTextContent("Type your idea, or pick a starting point");
    const box = within(ideas).getByLabelText(/Something you've seen/);
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(within(ideas).getByLabelText(/Something you've seen/), "A mini zoo");
    await user.click(within(ideas).getByRole("button", { name: "Eco-friendly" }));
    expect(within(ideas).getByRole("button", { name: "Eco-friendly" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(ideas).getByRole("button", { name: "Get ideas" }));

    expect(await within(ideas).findByRole("heading", { name: "Mini zoo corner" })).toBeInTheDocument();
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sent).toMatchObject({ mode: "more", leanings: ["eco"], heart: { own: "A mini zoo" } });
    // The old ideas are still there, with the new ones added.
    expect(within(ideas).getByRole("heading", { name: "Treasure hunt" })).toBeInTheDocument();
  });

  it("keeps, skips and brings back ideas, and asks for more like one", async () => {
    const user = userEvent.setup();
    render(<Harness initial={start()} />);
    await openSection("Ideas");
    const ideas = currentSection();

    await user.click(within(ideas).getByRole("button", { name: "Keep: Leaf garlands" }));
    expect(within(ideas).getByRole("button", { name: "Keep: Leaf garlands" })).toHaveAttribute("aria-pressed", "true");
    expect(saved.at(-1)?.ideaState?.kept).toHaveLength(1);

    await user.click(within(ideas).getByRole("button", { name: "Skip: Treasure hunt" }));
    expect(within(ideas).queryByRole("heading", { name: "Treasure hunt" })).not.toBeInTheDocument();
    await user.click(within(ideas).getByRole("button", { name: "Show 1 skipped idea" }));
    await user.click(within(ideas).getByRole("button", { name: "Bring back: Treasure hunt" }));
    expect(saved.at(-1)?.ideaState?.skipped).toEqual([]);

    await user.click(within(ideas).getByRole("button", { name: "More like this: Leaf garlands" }));
    await within(ideas).findByRole("heading", { name: "Safari hats" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).seed).toMatch(/^Leaf garlands/);
  });

  it("adds an idea to the plan with What changed and Undo", async () => {
    const user = userEvent.setup();
    const plan = {
      ...samplePlan,
      ideas: {
        signature: null,
        items: [newIdea("Jungle cake", { moment: "food", effort: "vendor", cost: 1500 }) as never],
      },
    };
    render(<Harness initial={start(plan)} />);
    await openSection("Ideas");
    const ideas = currentSection();

    await user.click(within(ideas).getByRole("button", { name: "Add to my plan: Jungle cake" }));
    const changed = await screen.findByRole("heading", { name: "What changed" });
    const box = changed.closest("section") as HTMLElement;
    expect(box).toHaveFocus();
    expect(within(box).getByText(/Added the task "Idea: Jungle cake"/)).toBeInTheDocument();
    expect(within(box).getByText(/Food: \+₹1,500, taken from Contingency/)).toBeInTheDocument();
    expect(within(box).getByText(/message for the caterer/)).toBeInTheDocument();
    expect(within(ideas).getByText("In your plan")).toBeInTheDocument();

    await openSection("Timeline");
    expect(within(currentSection()).getByText("Idea: Jungle cake")).toBeInTheDocument();

    await user.click(within(box).getByRole("button", { name: "Undo this change" }));
    await waitFor(() => expect(within(currentSection()).queryByText("Idea: Jungle cake")).not.toBeInTheDocument());
    expect(saved.at(-1)?.ideaState?.added ?? []).toEqual([]);
  });

  it("shows a friendly error when Shubā is busy", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: "Shubā is very busy right now. Please try again in a minute." }, 503),
    );
    const user = userEvent.setup();
    render(<Harness initial={start()} />);
    await openSection("Ideas");
    await user.click(within(currentSection()).getByRole("button", { name: "Show me 3 theme ideas" }));
    expect(await within(currentSection()).findByRole("alert")).toHaveTextContent("very busy");
  });

  it("filters ideas by function and has no accessibility problems", async () => {
    const plan: Plan = {
      ...weddingPlan,
      ideas: {
        signature: { title: "Thali moment", detail: "Everyone showers flowers." },
        items: [
          newIdea("Henna bar", { forFunction: "Mehendi" }) as never,
          newIdea("Nadaswaram at entry", { forFunction: "Muhurtham", moment: "arrival" }) as never,
        ],
      },
    };
    const user = userEvent.setup();
    const view = render(<Harness initial={start(plan, { ...baseInput, eventType: "wedding", days: 2 })} />);
    await openSection("Ideas");
    const ideas = currentSection();
    expect(within(ideas).getByText("Thali moment")).toBeInTheDocument();
    await user.click(within(ideas).getByRole("button", { name: "Mehendi" }));
    expect(within(ideas).getByRole("heading", { name: "Henna bar" })).toBeInTheDocument();
    expect(within(ideas).queryByRole("heading", { name: "Nadaswaram at entry" })).not.toBeInTheDocument();
    expect(within(ideas).getByLabelText("For which function?")).toBeInTheDocument();
    expect(await axe.run(view.container).then((r) => r.violations.map((v) => v.id))).toEqual([]);
  });
});

describe("Functions section", () => {
  it("lists functions day by day with dates, rituals and a check-with-elders note", async () => {
    const input = { ...baseInput, eventType: "wedding" as const, date: "2027-02-12", days: 2 };
    const view = render(<Harness initial={start(weddingPlan, input)} />);
    expect(screen.getByRole("heading", { name: "Your functions" })).toBeInTheDocument();
    expect(screen.getByText(/12 February 2027 · 2 days/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "See all functions" }));
    const fns = currentSection();
    expect(fns).toHaveAttribute("aria-label", "Functions");
    expect(within(fns).getByRole("heading", { name: /Day 2 · 13 Feb/ })).toBeInTheDocument();
    expect(within(fns).getByText("Mangalya dharanam")).toBeInTheDocument();
    expect(within(fns).getByText(/check the details with family elders/)).toBeInTheDocument();
    expect(within(fns).getByText("About ₹29,000")).toBeInTheDocument();
    expect(await axe.run(view.container).then((r) => r.violations.map((v) => v.id))).toEqual([]);
  });
});

describe("Traditions in the form", () => {
  it("suggests functions for both families, spread over the days, and sends the host's choices", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const view = render(<EventForm busy={false} onSubmit={onSubmit} />);
    await user.selectOptions(screen.getByLabelText(/Event type/), "wedding");
    await user.selectOptions(screen.getByLabelText("Your family's tradition"), "tamil");
    await user.selectOptions(screen.getByLabelText("The other family's tradition"), "punjabi");
    await user.selectOptions(screen.getByLabelText("How many days?"), "3");

    // Our family's functions and the ceremonies are ticked; the other family's extras are offered.
    expect(screen.getByLabelText("Nalangu")).toBeChecked();
    expect(screen.getByLabelText("Muhurtham")).toBeChecked();
    expect(screen.getByLabelText("Wedding (pheras)")).toBeChecked();
    expect(screen.getByLabelText("Sangeet")).not.toBeChecked();
    await user.click(screen.getByLabelText("Sangeet"));
    expect(screen.getByLabelText("Day for Reception")).toHaveValue("3");

    await user.click(screen.getByLabelText("Nalangu"));
    expect(screen.getByLabelText("Nalangu")).not.toBeChecked();
    await user.selectOptions(screen.getByLabelText("Day for Sangeet"), "2");
    await user.type(screen.getByLabelText("Add your own function"), "Mayra{Enter}");
    expect(screen.getByLabelText("Mayra")).toBeChecked();
    await user.click(screen.getByLabelText("Pre-wedding shoot"));
    expect(screen.getByLabelText("Day for Pre-wedding shoot")).toHaveValue("0");

    await user.type(screen.getByLabelText(/Date/), "2027-02-12");
    await user.type(screen.getByLabelText(/City/), "Chennai");
    await user.type(screen.getByLabelText(/Number of guests/), "300");
    await user.type(screen.getByLabelText(/Total budget/), "2000000");
    await user.click(screen.getByRole("button", { name: "Create my plan" }));

    const input = onSubmit.mock.calls[0][0] as EventInput;
    expect(input.traditions).toEqual(["tamil", "punjabi"]);
    expect(input.days).toBe(3);
    expect(input.additions).toEqual(["shoot"]);
    expect(input.functions.find((f) => f.name === "Sangeet")?.day).toBe(2);
    expect(input.functions.some((f) => f.name === "Nalangu" || f.name === "Roka")).toBe(false);
    expect(input.functions.some((f) => f.name === "Mayra")).toBe(true);
    expect(await axe.run(view.container).then((r) => r.violations.map((v) => v.id))).toEqual([]);
  });

  it("checks the host's own function names and asks which other tradition", async () => {
    const user = userEvent.setup();
    render(<EventForm busy={false} onSubmit={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText(/Event type/), "wedding");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("Please type the function's name")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Add your own function"), "Haldi{Enter}");
    expect(screen.getByText("That function is already in the list")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Your family's tradition"), "other");
    expect(screen.getByLabelText("Which tradition?")).toBeInTheDocument();
  });

  it("asks only for the tradition for smaller traditional events", async () => {
    const user = userEvent.setup();
    render(<EventForm busy={false} onSubmit={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText(/Event type/), "housewarming");
    expect(screen.getByLabelText("Tradition or community")).toBeInTheDocument();
    expect(screen.queryByLabelText("How many days?")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Event type/), "birthday");
    expect(screen.queryByLabelText("Tradition or community")).not.toBeInTheDocument();
  });
});
