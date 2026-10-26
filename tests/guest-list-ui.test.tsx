// @vitest-environment jsdom
import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import type { LocalWorkspace } from "@/lib/client";
import type { GuestEntry } from "@/lib/guestList";
import type { SharedPlanContent } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection, openSection } from "./nav";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-26T06:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const saved: { list: GuestEntry[] } = { list: [] };
function Harness({ planId = null, initial = [] }: { planId?: string | null; initial?: GuestEntry[] }) {
  const [data, setData] = useState<LocalWorkspace>({
    input: baseInput,
    plan: samplePlan,
    timings: null,
    team: [],
    assignments: {},
    done: {},
    guestList: initial,
  });
  return (
    <PlanWorkspace
      planKey="gl"
      planId={planId}
      data={data}
      shareUrl={planId ? `http://localhost/p/${planId}` : null}
      onChange={async (c: Partial<SharedPlanContent>) => {
        if (c.guestList) saved.list = c.guestList;
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

describe("Guest list", () => {
  it("builds the list from a pasted text, then invites, edits and removes", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await openSection("Guests");
    const guests = within(currentSection());
    expect(guests.getByRole("button", { name: "Guest list" })).toHaveAttribute("aria-pressed", "true");
    expect(guests.getByRole("heading", { name: "How do you want to add guests?" })).toBeInTheDocument();
    expect(guests.queryByRole("button", { name: /Pick from my contacts/ })).not.toBeInTheDocument(); // no picker in this browser
    expect(await violations(container)).toEqual([]);

    await user.click(guests.getByRole("button", { name: /Paste a list/ }));
    await user.type(
      guests.getByLabelText(/Paste or type names/),
      "Sharma family 4 - 98290 12345{enter}Meena aunty + Raj uncle{enter}Suresh mama & family",
    );
    await user.click(guests.getByRole("button", { name: "Read my list" }));
    expect(guests.getByText(/Found 3 entries, 10 people/)).toBeInTheDocument();
    expect(guests.getByText(/count guessed/)).toBeInTheDocument();
    await user.clear(guests.getByLabelText("People in Suresh mama & family"));
    await user.type(guests.getByLabelText("People in Suresh mama & family"), "5");
    await user.selectOptions(guests.getByLabelText("Side for these (optional)"), "family");
    await user.click(guests.getByRole("button", { name: "Add these 3" }));

    await waitFor(() => expect(saved.list).toHaveLength(3));
    expect(saved.list.map((e) => e.people)).toEqual([4, 2, 5]);
    expect(saved.list.every((e) => e.side === "family")).toBe(true);
    const list = within(guests.getByRole("list", { name: "Guest list" }));
    expect(guests.getByText(/11 of 40 planned · 29 seats left/)).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    const invite = list.getByRole("link", { name: /Send invite to Sharma family/ });
    const href = decodeURIComponent(invite.getAttribute("href") ?? "");
    expect(href).toContain("wa.me/919829012345");
    expect(href).toContain("Dear Sharma,");
    await user.click(invite);
    await waitFor(() => expect(saved.list[0].invitedAt).toBe("2026-10-26"));
    expect(list.getByText("Invited · no reply")).toBeInTheDocument();

    await user.click(list.getByRole("button", { name: "Edit Meena aunty + Raj uncle" }));
    const form = within(guests.getByRole("form", { name: "Edit Meena aunty + Raj uncle" }));
    await user.clear(form.getByLabelText("How many people"));
    await user.type(form.getByLabelText("How many people"), "3");
    await user.click(form.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved.list[1].people).toBe(3));

    await user.click(list.getByRole("button", { name: "Remove Suresh mama & family" }));
    await user.click(list.getByRole("button", { name: "Yes, remove" }));
    await waitFor(() => expect(saved.list).toHaveLength(2));

    await user.click(guests.getByRole("button", { name: "Not invited 1" }));
    expect(list.getAllByRole("listitem")).toHaveLength(1);
  });

  it("adds one by one and checks the name", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openSection("Guests");
    const guests = within(currentSection());
    await user.click(guests.getByRole("button", { name: /Add one by one/ }));
    await user.click(guests.getByRole("button", { name: "Add to list" }));
    expect(guests.getByLabelText("Name of the family or person")).toHaveAttribute("aria-invalid", "true");
    await user.type(guests.getByLabelText("Name of the family or person"), "Kapoor family");
    await user.clear(guests.getByLabelText("How many people"));
    await user.type(guests.getByLabelText("How many people"), "3");
    await user.click(guests.getByRole("button", { name: "Add to list" }));
    await waitFor(() => expect(saved.list).toMatchObject([{ name: "Kapoor family", people: 3 }]));
  });

  it("suggests groups with Help me build it, then adds names for one group", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        groups: [
          { name: "Close family", about: 25, who: "Grandparents, uncles, aunts", side: "family" },
          { name: "Friends", about: 15, who: "School friends", side: "friends" },
        ],
        reminders: ["Helpers need food too"],
        source: "ai",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<Harness />);
    await openSection("Guests");
    const guests = within(currentSection());
    await user.click(guests.getByRole("button", { name: /Help me build it/ }));
    expect(await guests.findByText("Close family · about 25")).toBeInTheDocument();
    expect(guests.getByText(/Helpers need food too/)).toBeInTheDocument();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/guestlist");
    expect(Object.keys(sent)).toEqual(["input", "functions"]);

    await user.click(guests.getByRole("button", { name: "Add names for Friends" }));
    await user.type(guests.getByLabelText(/Names for "Friends"/), "Anil, Sunita");
    await user.click(guests.getByRole("button", { name: "Read my list" }));
    expect(guests.getByLabelText("Side for these (optional)")).toHaveValue("friends");
    await user.click(guests.getByRole("button", { name: "Add these 2" }));
    await waitFor(() => expect(saved.list.map((e) => e.side)).toEqual(["friends", "friends"]));
  });

  it("shows replies against the list on a shared plan, and reminders after a week", async () => {
    const user = userEvent.setup();
    const list: GuestEntry[] = [
      {
        id: "gaaaa1",
        name: "Sharma family",
        people: 4,
        phone: "9829012345",
        side: "",
        functions: [],
        invitedAt: "2026-10-10",
        remindedAt: "",
      },
      {
        id: "gbbbb2",
        name: "Kapoor family",
        people: 3,
        phone: "",
        side: "",
        functions: [],
        invitedAt: "2026-10-10",
        remindedAt: "",
      },
    ];
    const replies = [
      {
        id: "r000001",
        name: "Vikram Sharma",
        phone: "+91 98290 12345",
        coming: "yes",
        adults: 3,
        kids: 1,
        food: "veg",
        needs: [],
        group: "",
        note: "",
        createdAt: "2026-10-20T00:00:00Z",
        updatedAt: "2026-10-20T00:00:00Z",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ link: { token: "T".repeat(22), open: true }, replies })));
    render(<Harness planId={"P".repeat(22)} initial={list} />);
    await openSection("Guests");
    const guests = within(currentSection());
    const rows = within(guests.getByRole("list", { name: "Guest list" }));
    expect(await rows.findByText("Coming 4")).toBeInTheDocument();
    expect(guests.getByText(/1 family hasn't replied in a week/)).toBeInTheDocument();
    const remind = rows.getByRole("link", { name: /Remind Kapoor family/ });
    expect(decodeURIComponent(remind.getAttribute("href") ?? "")).toContain(`/r/${"T".repeat(22)}`);
    await user.click(remind);
    await waitFor(() => expect(saved.list[1].remindedAt).toBe("2026-10-26"));
  });
});
