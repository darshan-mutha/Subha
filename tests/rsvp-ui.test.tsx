// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestReply } from "@/components/GuestReply";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import type { LocalWorkspace } from "@/lib/client";
import { guestEvent, type Reply } from "@/lib/rsvp";
import type { SharedPlanContent } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";
import { currentSection } from "./nav";

const TOKEN = "T".repeat(22);
const PLAN = "P".repeat(22);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("Guest reply page", () => {
  it("shows the invitation, checks answers, sends the reply and lets the guest change it", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(guestEvent(baseInput, null, true)))
      .mockResolvedValueOnce(json({ replyId: "rabc123", secret: "S".repeat(22) }))
      .mockResolvedValueOnce(json({ replyId: "rabc123", secret: "S".repeat(22) }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<GuestReply token={TOKEN} />);

    expect(await screen.findByRole("heading", { name: "You're invited!" })).toBeInTheDocument();
    expect(screen.getByText("Aarav turns 5")).toBeInTheDocument();
    expect(screen.queryByText(/50,000/)).not.toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Send my reply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please check");
    expect(screen.getByLabelText("Your name")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText("Your name"), "Meena");
    await user.click(screen.getByRole("radio", { name: "Yes, we're coming" }));
    await user.clear(screen.getByLabelText("Adults"));
    await user.type(screen.getByLabelText("Adults"), "2");
    await user.clear(screen.getByLabelText("Children"));
    await user.type(screen.getByLabelText("Children"), "1");
    await user.selectOptions(screen.getByLabelText("Food"), "jain");
    await user.click(screen.getByRole("checkbox", { name: "An elderly person is with us" }));
    await user.click(screen.getByRole("button", { name: "Send my reply" }));

    const thanks = await screen.findByRole("heading", { name: "Thank you, Meena!" });
    await waitFor(() => expect(thanks).toHaveFocus());
    expect(screen.getByText("Coming: 2 adults and 1 child.")).toBeInTheDocument();
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(sent.reply).toMatchObject({
      name: "Meena",
      coming: "yes",
      adults: 2,
      kids: 1,
      food: "jain",
      needs: ["elderly"],
    });
    expect(sent.replyId).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Change my reply" }));
    expect(screen.getByLabelText("Your name")).toHaveValue("Meena");
    await user.click(screen.getByRole("radio", { name: "Sorry, can't come" }));
    expect(screen.queryByLabelText("Adults")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save my reply" }));
    await screen.findByText(/You can't come/);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ replyId: "rabc123", secret: "S".repeat(22) });
  });

  it("says when replies are closed, and when a link is wrong", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(guestEvent(baseInput, null, false))));
    const first = render(<GuestReply token={TOKEN} />);
    expect(await screen.findByRole("heading", { name: "Replies are closed" })).toBeInTheDocument();
    first.unmount();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "This invitation link could not be found." }, 404)));
    render(<GuestReply token={TOKEN} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be found");
  });
});

/* ------------------------------------------------------------------ */

const reply = (over: Partial<Reply>): Reply => ({
  id: "r000001",
  name: "Meena",
  phone: "98450 12345",
  coming: "yes",
  adults: 2,
  kids: 1,
  food: "veg",
  needs: [],
  group: "",
  note: "",
  createdAt: "2026-10-26T06:00:00.000Z",
  updatedAt: "2026-10-26T06:00:00.000Z",
  ...over,
});
const replies = [
  reply({}),
  reply({ id: "r000002", name: "Ravi", adults: 20, kids: 5, food: "jain", needs: ["wheelchair"] }),
  reply({ id: "r000003", name: "Anu", coming: "maybe", adults: 20, kids: 0 }),
  reply({ id: "r000004", name: "Joseph", coming: "no", adults: 0, kids: 0 }),
];

const start: LocalWorkspace = {
  input: baseInput,
  plan: samplePlan,
  timings: null,
  team: [],
  assignments: {},
  done: {},
};

function Harness({ planId, onShare }: { planId: string | null; onShare: (tab?: string) => Promise<void> }) {
  const [data, setData] = useState(start);
  return (
    <PlanWorkspace
      planKey="guests"
      planId={planId}
      initialTab="guests"
      data={data}
      shareUrl={planId ? `http://localhost/p/${planId}` : null}
      onChange={async (c: Partial<SharedPlanContent>) => setData((d) => ({ ...d, ...c }))}
      onToggle={vi.fn()}
      onShare={onShare}
      onEdit={null}
      onStartOver={vi.fn()}
      viewer=""
      onViewerChange={vi.fn()}
    />
  );
}

describe("Guests tab", () => {
  it("asks to save the plan online before giving a guest link", async () => {
    const onShare = vi.fn().mockResolvedValue(undefined);
    render(<Harness planId={null} onShare={onShare} />);
    const panel = within(currentSection());
    await userEvent.click(panel.getByRole("button", { name: "Get my guest link" }));
    expect(onShare).toHaveBeenCalledWith("guests");
  });

  it("turns on replies, shows counts and updates the plan's guest count", async () => {
    const user = userEvent.setup();
    const refined = {
      input: { ...baseInput, guests: 69 },
      plan: samplePlan,
      timings: null,
      changes: ["Guests: 40 → 69"],
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `/api/plans/${PLAN}/guests` && init?.method === "GET") return json({ link: null, replies: [] });
      if (url === `/api/plans/${PLAN}/guests`) {
        const body = JSON.parse(String(init?.body));
        if (body.action === "open") return json({ link: { token: TOKEN, open: true }, replies });
        if (body.action === "remove") return json({ link: { token: TOKEN, open: true }, replies: replies.slice(0, 3) });
      }
      if (url === "/api/refine") return json(refined);
      return json({ error: "unexpected" }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<Harness planId={PLAN} onShare={vi.fn()} />);
    const panel = within(currentSection());

    await user.click(await panel.findByRole("button", { name: "Turn on guest replies" }));
    expect(await panel.findByText(`http://localhost:3000/r/${TOKEN}`)).toBeInTheDocument();
    const whatsapp = panel.getByRole("link", { name: /Send on WhatsApp/ });
    expect(decodeURIComponent(whatsapp.getAttribute("href") ?? "")).toContain(`/r/${TOKEN}`);

    expect(panel.getByText("28 people")).toBeInTheDocument(); // Meena 3 + Ravi 25
    expect(panel.getByText(/22 adults, 6 children · 2 families/)).toBeInTheDocument();
    expect(panel.getByRole("row", { name: /Jain 25 0/ })).toBeInTheDocument();
    expect(panel.getByText("Wheelchair or step-free access: 1 family")).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "Download list" })).toHaveAttribute("download", "guest-replies.csv");
    expect(await violations(container)).toEqual([]);

    await user.click(panel.getByRole("button", { name: "Update the plan to 48 guests" }));
    await screen.findByText("Guests: 40 → 69");
    const sent = fetchMock.mock.calls.find(([url]) => url === "/api/refine")!;
    expect(JSON.parse(String(sent[1]?.body)).instruction).toContain("guest count to 48");

    await user.click(panel.getByRole("button", { name: "Remove the reply from Joseph" }));
    await user.click(panel.getByRole("button", { name: "Yes, remove" }));
    await waitFor(() => expect(panel.queryByText("Joseph")).not.toBeInTheDocument());
  });

  it("suggests seating from replies and saves a move", async () => {
    const user = userEvent.setup();
    const seatReplies = [
      reply({ id: "r000011", name: "Nani", adults: 2, kids: 0, needs: ["elderly"], group: "family" }),
      reply({ id: "r000012", name: "Kumar", adults: 6, kids: 0, group: "friends" }),
      reply({ id: "r000013", name: "Shah", adults: 4, kids: 2, group: "friends" }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ link: { token: TOKEN, open: true }, replies: seatReplies })),
    );
    const changes: unknown[] = [];
    function SeatHarness() {
      const [data, setData] = useState(start);
      return (
        <PlanWorkspace
          planKey="seating"
          planId={PLAN}
          initialTab="guests"
          data={data}
          shareUrl={`http://localhost/p/${PLAN}`}
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
    const { container } = render(<SeatHarness />);
    const panel = within(currentSection());
    const seating = within(await panel.findByRole("region", { name: "Seating plan" }));
    expect(seating.getByText(/3 tables of 8 for 14 people/)).toBeInTheDocument();
    const first = within(seating.getAllByRole("listitem").find((li) => li.className.includes("seat-table"))!);
    expect(first.getByRole("heading", { name: "Table 1" })).toBeInTheDocument();
    expect(first.getByText(/Near the entrance/)).toBeInTheDocument();
    expect(first.getByLabelText("Move Nani to")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    await user.selectOptions(seating.getByLabelText("Move Nani to"), "Table 2");
    await waitFor(() =>
      expect(changes).toContainEqual({ seating: expect.objectContaining({ moves: { r000011: 2 } }) }),
    );
    expect(seating.getByText(/You moved 1 family/)).toBeInTheDocument();
    await user.click(seating.getByRole("button", { name: "Undo my moves" }));
    await waitFor(() => expect(seating.queryByText(/You moved/)).not.toBeInTheDocument());

    await user.selectOptions(seating.getByLabelText("People per table"), "12");
    expect(seating.getByText(/of 12 for 14 people/)).toBeInTheDocument();
  });
});
