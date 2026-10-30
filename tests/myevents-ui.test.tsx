// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Planner } from "@/components/Planner";
import { SharedPlanView } from "@/components/SharedPlanView";
import type { LocalWorkspace } from "@/lib/client";
import { listEvents, saveEvent, setCurrentEvent } from "@/lib/myEvents";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection, menuAction, openSection } from "./nav";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const ws = (over: Partial<LocalWorkspace["input"]> = {}): LocalWorkspace => ({
  input: { ...baseInput, ...over },
  plan: samplePlan,
  timings: null,
  team: [],
  assignments: {},
  done: {},
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T06:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  push.mockReset();
  window.history.replaceState(null, "", "/");
});

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("My events", () => {
  it("keeps the first plan when starting a second, and switches between them", async () => {
    const user = userEvent.setup();
    localStorage.setItem("shuba:last-plan:v2", JSON.stringify(ws())); // a plan from the one-plan version
    const housewarming = { ...baseInput, eventType: "housewarming" as const, eventName: "Griha pravesh" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ input: housewarming, plan: samplePlan, timings: null })));
    const { container } = render(<Planner />);

    expect(screen.getByRole("heading", { name: "Aarav turns 5" })).toBeInTheDocument();
    await menuAction("Plan a new event");
    await user.click(screen.getByRole("button", { name: /Fill in the details yourself/ }));
    await user.click(screen.getByRole("button", { name: "Kid's birthday" }));
    await user.click(screen.getByRole("button", { name: "Create my plan" }));
    expect(await screen.findByRole("heading", { name: "Griha pravesh" })).toBeInTheDocument();

    await menuAction("My events (2)");
    const list = screen.getByRole("region", { name: "My events" });
    expect(within(list).getByRole("heading", { name: "Aarav turns 5" })).toBeInTheDocument();
    expect(within(list).getByRole("heading", { name: "Griha pravesh" })).toBeInTheDocument();
    expect(within(list).getAllByText("In 47 days")).toHaveLength(2);
    expect(await violations(container)).toEqual([]);

    await user.click(within(list).getByRole("button", { name: "Open Aarav turns 5" }));
    expect(screen.getByRole("heading", { name: "Aarav turns 5" })).toBeInTheDocument();
    expect(listEvents()).toHaveLength(2);
  });

  it("opens the list on a fresh visit, and removes an event after asking", async () => {
    const user = userEvent.setup();
    saveEvent("eaaaa1", ws());
    saveEvent("ebbbb2", ws({ eventName: "Diwali party", eventType: "festival", date: "2026-11-08" }));
    render(<Planner />);
    const list = screen.getByRole("region", { name: "My events" });
    const titles = within(list)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titles).toEqual(["Diwali party", "Aarav turns 5"]); // soonest first

    await user.click(within(list).getByRole("button", { name: "Remove Diwali party" }));
    const confirm = within(list).getByRole("group", { name: "Remove Diwali party?" });
    await user.click(within(confirm).getByRole("button", { name: "Keep it" }));
    expect(listEvents()).toHaveLength(2);
    await user.click(within(list).getByRole("button", { name: "Remove Diwali party" }));
    await user.click(within(list).getByRole("button", { name: "Yes, remove" }));
    expect(within(list).queryByText("Diwali party")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Diwali party removed from this device");

    await user.click(within(list).getByRole("button", { name: "Remove Aarav turns 5" }));
    await user.click(within(list).getByRole("button", { name: "Yes, remove" }));
    expect(screen.getByRole("heading", { name: "Tell us about your celebration" })).toBeInTheDocument();
  });

  it("keeps a shared event in the list and opens it from its team link", async () => {
    const user = userEvent.setup();
    saveEvent("eaaaa1", ws());
    setCurrentEvent("eaaaa1");
    const id = "B".repeat(22);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ id })));
    const view = render(<Planner />);
    await openSection("Team");
    await user.click(screen.getByRole("button", { name: "Share this plan with my team" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/p/${id}?new=1`));
    expect(listEvents()).toMatchObject([{ key: "eaaaa1", sharedId: id }]);

    view.unmount();
    render(<Planner />);
    const list = screen.getByRole("region", { name: "My events" });
    expect(within(list).getByText("Shared with team")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Open Aarav turns 5" }));
    expect(push).toHaveBeenLastCalledWith(`/p/${id}`);
  });

  it("follows the view asked for in the address", () => {
    saveEvent("eaaaa1", ws());
    setCurrentEvent("eaaaa1");
    window.history.replaceState(null, "", "/?view=new");
    const first = render(<Planner />);
    expect(screen.getByRole("heading", { name: "Tell us about your celebration" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to my events (1)" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
    first.unmount();
    window.history.replaceState(null, "", "/?view=events");
    render(<Planner />);
    expect(screen.getByRole("region", { name: "My events" })).toBeInTheDocument();
  });

  it("adds a plan opened from someone's team link to this device's list", async () => {
    const id = "C".repeat(22);
    const shared = { ...ws(), id, version: 1, updatedAt: "2026-10-26T06:00:00Z", deals: {}, shifts: {}, invite: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(shared)));
    render(<SharedPlanView id={id} />);
    expect(await screen.findByRole("heading", { name: "Aarav turns 5" })).toBeInTheDocument();
    await waitFor(() => expect(listEvents()).toMatchObject([{ sharedId: id, title: "Aarav turns 5" }]));
    await menuAction("My events");
    expect(push).toHaveBeenCalledWith("/?view=events");
  });
});

describe("Shared page from the address", () => {
  it("opens the tab passed in and shows the right note, even if the address bar has not changed yet", async () => {
    const id = "D".repeat(22);
    const shared = { ...ws(), id, version: 1, updatedAt: "2026-10-26T06:00:00Z", deals: {}, shifts: {}, invite: null };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url.endsWith("/guests") ? json({ link: null, replies: [] }) : json(shared))),
    );
    render(<SharedPlanView id={id} initialTab="guests" isNew />);
    await screen.findByRole("heading", { name: "Aarav turns 5" });
    expect(currentSection()).toHaveAttribute("aria-label", "Guests");
    expect(screen.getByText(/Turn on guest replies below/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Turn on guest replies" })).toBeVisible();
  });
});
