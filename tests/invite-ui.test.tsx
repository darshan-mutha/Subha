// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import type { LocalWorkspace } from "@/lib/client";
import type { SharedPlanContent } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

const saved: Partial<SharedPlanContent>[] = [];

function Harness({ initial }: { initial: LocalWorkspace }) {
  const [data, setData] = useState(initial);
  return (
    <PlanWorkspace
      planKey="invite"
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

const start: LocalWorkspace = {
  input: baseInput,
  plan: samplePlan,
  timings: null,
  team: [],
  assignments: {},
  done: {},
};

const reply = {
  wording: {
    heading: "आप सादर आमंत्रित हैं",
    message: "आरव के जन्मदिन पर आप सपरिवार पधारें।",
    closing: "सप्रेम, राव परिवार",
  },
  source: "ai",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  saved.length = 0;
  // jsdom cannot draw, so the card falls back to its text version.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  fetchMock = vi.fn(async () => new Response(JSON.stringify(reply), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openInvite() {
  const user = userEvent.setup();
  const view = render(<Harness initial={start} />);
  await user.click(screen.getByRole("tab", { name: "Invite" }));
  return { user, ...view };
}

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("Invite tab", () => {
  it("writes an invite in the chosen language and saves it with the plan", async () => {
    const { user } = await openInvite();
    await user.selectOptions(screen.getByLabelText("Language"), "hi");
    await user.click(screen.getByRole("radio", { name: "Traditional" }));
    await user.type(screen.getByLabelText("Hosted by (optional)"), "Rao family");
    await user.type(screen.getByLabelText("Venue (optional)"), "Sunshine Clubhouse");
    await user.type(screen.getByLabelText("Time (optional)"), "4:00 PM");
    await user.click(screen.getByRole("button", { name: "Write my invite" }));

    const card = await screen.findByRole("img", { name: /Invitation card\. आप सादर आमंत्रित हैं/ });
    expect(card).toHaveAccessibleName(expect.stringContaining("Sunshine Clubhouse, Bengaluru"));
    expect(card).toHaveAccessibleName(expect.stringContaining("दिसंबर"));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/invite");
    expect(body.details).toMatchObject({ language: "hi", tone: "formal", hosts: "Rao family", time: "4:00 PM" });

    expect(saved.at(-1)?.invite).toMatchObject({ look: "peacock", wording: reply.wording });
    const whatsapp = screen.getByRole("link", { name: "Send on WhatsApp" });
    expect(decodeURIComponent(whatsapp.getAttribute("href") ?? "")).toContain("⏰ 4:00 PM");
  });

  it("lets the host change words and look, and saves the change", async () => {
    const { user } = await openInvite();
    await user.click(screen.getByRole("button", { name: "Write my invite" }));
    const heading = await screen.findByLabelText("Heading");
    await user.clear(heading);
    await user.type(heading, "Come celebrate!");
    await user.tab();
    await waitFor(() => expect(saved.at(-1)?.invite?.wording.heading).toBe("Come celebrate!"));

    await user.click(screen.getByRole("radio", { name: "Haldi" }));
    await waitFor(() => expect(saved.at(-1)?.invite?.look).toBe("haldi"));
    expect(await screen.findByRole("img", { name: /Come celebrate!/ })).toBeInTheDocument();
  });

  it("does not save an empty heading", async () => {
    const { user } = await openInvite();
    await user.click(screen.getByRole("button", { name: "Write my invite" }));
    const heading = await screen.findByLabelText("Heading");
    const before = saved.length;
    await user.clear(heading);
    await user.tab();
    expect(await screen.findByText("Please add the heading")).toBeInTheDocument();
    expect(saved.length).toBe(before);
  });

  it("shows a clear error when Shubā is busy", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests. Please wait a minute and try again." }), {
        status: 429,
      }),
    );
    const { user } = await openInvite();
    await user.click(screen.getByRole("button", { name: "Write my invite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    expect(saved).toHaveLength(0);
  });

  it("has no accessibility violations before and after writing", async () => {
    const { user, container } = await openInvite();
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Write my invite" }));
    await screen.findByLabelText("Heading");
    expect(await violations(container)).toEqual([]);
  });
});
