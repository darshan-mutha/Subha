// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InviteMaker } from "@/components/InviteMaker";
import { ApiError } from "@/lib/client";
import type { Invite } from "@/lib/invite";
import type * as InviteCardLib from "@/lib/inviteCard";
import { baseInput } from "./fixtures";

const draw = vi.hoisted(() => vi.fn<() => Promise<Blob | null>>());

// jsdom cannot draw on a canvas, so stand in for the drawing step.
vi.mock("@/lib/inviteCard", async (importOriginal) => {
  const actual = await importOriginal<typeof InviteCardLib>();
  return { ...actual, renderInviteCard: draw };
});

const wording = { heading: "You're invited", message: "Join us for Aarav's birthday.", closing: "With love, the Raos" };
const written: Invite = {
  details: { language: "en", tone: "warm", hosts: "", venue: "Sunshine Clubhouse", time: "", note: "" },
  wording,
  look: "peacock",
  source: "ai",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let canShare: ReturnType<typeof vi.fn>;
let share: ReturnType<typeof vi.fn>;

beforeEach(() => {
  draw.mockReset();
  draw.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  // jsdom has no object URLs.
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:card") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  canShare = vi.fn(() => true);
  share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "canShare", { configurable: true, value: canShare });
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(navigator, "share");
});

describe("InviteMaker card", () => {
  it("shows the drawn card and shares it as a file with the message", async () => {
    const user = userEvent.setup();
    render(<InviteMaker input={baseInput} invite={written} onSave={vi.fn().mockResolvedValue(undefined)} />);
    const img = await screen.findByRole("img", { name: /Invitation card\. You're invited/ });
    expect(img).toHaveAttribute("src", "blob:card");
    expect(screen.getByRole("link", { name: "Download image" })).toHaveAttribute("href", "blob:card");

    await user.click(screen.getByRole("button", { name: "Share card" }));
    expect(share).toHaveBeenCalledTimes(1);
    const sent = share.mock.calls[0][0];
    expect(sent.files[0]).toBeInstanceOf(File);
    expect(sent.files[0].type).toBe("image/png");
    expect(sent.text).toContain("You're invited");
  });

  it("ignores a closed share sheet", async () => {
    share.mockRejectedValue(new Error("AbortError"));
    const user = userEvent.setup();
    render(<InviteMaker input={baseInput} invite={written} onSave={vi.fn().mockResolvedValue(undefined)} />);
    await user.click(await screen.findByRole("button", { name: "Share card" }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hides Share card when the browser cannot share files", async () => {
    canShare.mockImplementation(() => {
      throw new Error("not allowed");
    });
    render(<InviteMaker input={baseInput} invite={written} onSave={vi.fn().mockResolvedValue(undefined)} />);
    await screen.findByRole("img", { name: /You're invited/ });
    expect(screen.queryByRole("button", { name: "Share card" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Send on WhatsApp" })).toHaveClass("btn-primary");
  });

  it("falls back to a text card when drawing fails, and says when the words are standard", async () => {
    draw.mockResolvedValue(null);
    render(
      <InviteMaker
        input={baseInput}
        invite={{ ...written, source: "standard", details: { ...written.details, time: "4 PM", note: "No gifts" } }}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const card = await screen.findByRole("img", { name: /You're invited/ });
    expect(card).toHaveTextContent("4 PM");
    expect(card).toHaveTextContent("No gifts");
    expect(screen.getByText(/these are standard English words/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download image" })).not.toBeInTheDocument();
  });
});

describe("InviteMaker editing", () => {
  it("checks the details before asking Claude", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<InviteMaker input={baseInput} invite={null} onSave={vi.fn()} />);
    await user.type(screen.getByLabelText("Venue (optional)"), "Hall <b>");
    await user.click(screen.getByRole("button", { name: "Write my invite" }));
    expect(screen.getByText("Venue contains characters that are not allowed")).toBeInTheDocument();
    expect(screen.getByLabelText("Venue (optional)")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a plain message when saving fails, and the server's message when it explains", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ wording, source: "ai" })));
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new ApiError("Plan was changed by someone else."));
    const user = userEvent.setup();
    render(<InviteMaker input={baseInput} invite={null} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: "Write my invite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the invite");

    await user.click(screen.getByRole("radio", { name: "Ivory" }));
    expect(await screen.findByText("Plan was changed by someone else.")).toBeInTheDocument();
  });

  it("writes again from the details panel and reports an unexpected failure plainly", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<InviteMaker input={baseInput} invite={written} onSave={vi.fn().mockResolvedValue(undefined)} />);
    await user.click(screen.getByText("Change language or tone"));
    await user.click(screen.getByRole("button", { name: "Write again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach Shubā");
    expect(fetchMock).toHaveBeenCalledWith("/api/invite", expect.anything());
  });

  it("takes in an invite saved elsewhere unless the host is mid-edit", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const view = render(<InviteMaker input={baseInput} invite={written} onSave={onSave} />);
    const other: Invite = { ...written, wording: { ...wording, heading: "From a helper" }, look: "haldi" };
    view.rerender(<InviteMaker input={baseInput} invite={other} onSave={onSave} />);
    expect(screen.getByLabelText("Heading")).toHaveValue("From a helper");
    expect(screen.getByRole("radio", { name: "Haldi" })).toBeChecked();

    await user.type(screen.getByLabelText("Venue (optional)"), " Hall");
    const third: Invite = { ...other, wording: { ...wording, heading: "Third" } };
    view.rerender(<InviteMaker input={baseInput} invite={third} onSave={onSave} />);
    expect(screen.getByLabelText("Heading")).toHaveValue("From a helper");
    expect(screen.getByLabelText("Venue (optional)")).toHaveValue("Sunshine Clubhouse Hall");
    await waitFor(() => expect(draw).toHaveBeenCalled());
  });
});
