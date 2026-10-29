// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import type { LocalWorkspace } from "@/lib/client";
import type { GuestEntry } from "@/lib/guestList";
import type { Plan } from "@/lib/schemas";
import type { SharedPlanContent } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection, openSection } from "./nav";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const fn = (name: string, day: number, guests: number) => ({
  name,
  day,
  time: "Evening",
  guests,
  amount: 10000,
  mood: "",
  rituals: [],
  needs: [],
});
const plan: Plan = { ...samplePlan, functions: [fn("Mehendi", 1, 10), fn("Sangeet", 1, 12)] };
const entry = (id: string, name: string, people: number, functions: string[] = []): GuestEntry => ({
  id,
  name,
  people,
  phone: "",
  side: "",
  functions,
  invitedAt: "",
  remindedAt: "",
});
const list = [
  entry("gaaaaaa", "Sharma family", 6),
  entry("gbbbbbb", "Kapoor family", 12, ["Sangeet"]),
  entry("gcccccc", "Mehta family", 5, ["Mehendi"]),
];

const changes: Partial<SharedPlanContent>[] = [];
function Harness() {
  const [data, setData] = useState<LocalWorkspace>({
    input: { ...baseInput, eventType: "wedding", days: 1 },
    plan,
    timings: null,
    team: [],
    assignments: {},
    done: {},
    guestList: list,
  });
  return (
    <PlanWorkspace
      planKey="sl"
      planId={null}
      data={data}
      shareUrl={null}
      onChange={async (c: Partial<SharedPlanContent>) => {
        changes.push(c);
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

describe("Guest list linked to seating and functions", () => {
  it("seats the list before replies, one function at a time", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    // Home shows how many are invited to each function.
    expect(screen.getByText(/Mehendi \(11 invited\), Sangeet \(18 invited\)/)).toBeInTheDocument();

    await openSection("Guests");
    await user.click(within(currentSection()).getByRole("button", { name: "Seating" }));
    const guests = within(currentSection());
    expect(guests.getByRole("button", { name: "Everyone on my list" })).toHaveAttribute("aria-pressed", "true");
    expect(guests.getByText(/tables? of/)).toHaveTextContent("23 people (3 families)");
    expect(guests.getAllByText(/no reply yet/)).toHaveLength(4); // the family of 12 fills two tables
    expect(await violations(container)).toEqual([]);

    await user.click(guests.getByRole("button", { name: "Sangeet" }));
    await waitFor(() => expect(changes.at(-1)?.seating?.fn).toBe("Sangeet"));
    expect(guests.getByText(/tables? of/)).toHaveTextContent("18 people (2 families) at the Sangeet");

    await user.click(guests.getByRole("button", { name: "Only those coming" }));
    await waitFor(() => expect(changes.at(-1)?.seating?.from).toBe("replies"));
    expect(guests.getByText(/No one invited to the Sangeet has said yes yet/)).toBeInTheDocument();
  });

  it("shows guest-list counts on each function and opens its seating", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await openSection("Functions");
    const fns = within(currentSection());
    const sangeet = within(fns.getByRole("heading", { name: "Sangeet" }).closest("article")!);
    expect(sangeet.getByText(/18 invited/)).toBeInTheDocument();
    expect(sangeet.getByText("6 more invited than planned (12).")).toBeInTheDocument();
    expect(sangeet.getByRole("button", { name: "Plan for 18" })).toBeInTheDocument();
    const mehendi = within(fns.getByRole("heading", { name: "Mehendi" }).closest("article")!);
    expect(mehendi.queryByRole("button", { name: /Plan for/ })).not.toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    await user.click(mehendi.getByRole("button", { name: "Seat this function" }));
    await waitFor(() => expect(within(currentSection()).getByRole("heading", { name: "Seating plan" })).toBeVisible());
    const seating = within(currentSection());
    expect(seating.getByRole("button", { name: "Mehendi" })).toHaveAttribute("aria-pressed", "true");
    expect(seating.getByText(/tables? of/)).toHaveTextContent("at the Mehendi");
  });
});
