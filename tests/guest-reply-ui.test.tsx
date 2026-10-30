// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestReply, replySentence } from "@/components/GuestReply";
import { guestEvent, type ReplyInput } from "@/lib/rsvp";
import { baseInput } from "./fixtures";

const TOKEN = "T".repeat(22);
const KEY = `shuba:rsvp:${TOKEN}`;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const savedReply: ReplyInput = {
  name: "Meena",
  phone: "",
  coming: "maybe",
  adults: 2,
  kids: 0,
  food: "any",
  needs: [],
  group: "",
  note: "",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("replySentence", () => {
  it("sums up yes, maybe and no replies", () => {
    expect(replySentence({ ...savedReply, coming: "yes", adults: 1, kids: 2 })).toBe("Coming: 1 adult and 2 children.");
    expect(replySentence(savedReply)).toBe("Maybe coming: 2 adults.");
    expect(replySentence({ ...savedReply, coming: "no" })).toBe("You can't come. The hosts will miss you.");
  });
});

describe("Guest reply page states", () => {
  it("shows a loading note until the invitation arrives", async () => {
    let answer: (r: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    render(<GuestReply token={TOKEN} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the invitation");
    answer(json(guestEvent(baseInput, null, true)));
    expect(await screen.findByRole("heading", { name: "Will you join us?" })).toBeInTheDocument();
  });

  it("uses a plain message when the invitation cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<GuestReply token={TOKEN} />);
    expect(await screen.findByRole("heading", { name: "Invitation not found" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not reach Shubā");
  });

  it("ignores a broken saved reply", async () => {
    localStorage.setItem(KEY, "{not json");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(guestEvent(baseInput, null, true))));
    render(<GuestReply token={TOKEN} />);
    expect(await screen.findByRole("heading", { name: "Will you join us?" })).toBeInTheDocument();
  });

  it("shows a saved reply, lets the guest cancel a change, and sends it as new if the old one was removed", async () => {
    localStorage.setItem(KEY, JSON.stringify({ replyId: "rold111", secret: "S".repeat(22), reply: savedReply }));
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(guestEvent(baseInput, null, true)))
      .mockResolvedValueOnce(json({ error: "This reply was removed." }, 403))
      .mockResolvedValueOnce(json({ replyId: "rnew222", secret: "N".repeat(22) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<GuestReply token={TOKEN} />);

    expect(await screen.findByRole("heading", { name: "Thank you, Meena!" })).toBeInTheDocument();
    expect(screen.getByText("Maybe coming: 2 adults.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change my reply" }));
    expect(screen.getByRole("heading", { name: "Change your reply" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Change my reply" }));
    expect(screen.getByLabelText("Adults")).toHaveValue(2);

    await user.click(screen.getByRole("radio", { name: "Yes, we're coming" }));
    await user.click(screen.getByRole("button", { name: "Save my reply" }));
    expect(await screen.findByText("Coming: 2 adults.")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ replyId: "rold111" });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).replyId).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toMatchObject({ replyId: "rnew222" });
  });

  it("does not resend when a saved reply fails for another reason", async () => {
    localStorage.setItem(KEY, JSON.stringify({ replyId: "rold111", secret: "S".repeat(22), reply: savedReply }));
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(guestEvent(baseInput, null, true)))
      .mockResolvedValueOnce(json({ error: "Replies are closed." }, 409));
    vi.stubGlobal("fetch", fetchMock);
    render(<GuestReply token={TOKEN} />);
    await user.click(await screen.findByRole("button", { name: "Change my reply" }));
    await user.click(screen.getByRole("button", { name: "Save my reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Replies are closed.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the server's field errors and moves focus to the message", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(guestEvent(baseInput, null, true)))
        .mockResolvedValueOnce(json({ error: "Please check your answers.", fields: { name: "Name is taken" } }, 400)),
    );
    render(<GuestReply token={TOKEN} />);
    await user.type(await screen.findByLabelText("Your name"), "Ravi");
    await user.click(screen.getByRole("radio", { name: "Sorry, can't come" }));
    await user.click(screen.getByRole("button", { name: "Send my reply" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Please check your answers.");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByText("Name is taken")).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toHaveAttribute("aria-invalid", "true");
  });

  it("treats empty counts as zero and still checks them", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValueOnce(json(guestEvent(baseInput, null, true)));
    vi.stubGlobal("fetch", fetchMock);
    render(<GuestReply token={TOKEN} />);
    await user.type(await screen.findByLabelText("Your name"), "Ravi");
    await user.click(screen.getByRole("radio", { name: "Yes, we're coming" }));
    await user.clear(screen.getByLabelText("Adults"));
    await user.clear(screen.getByLabelText("Children"));
    await user.click(screen.getByRole("button", { name: "Send my reply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please check");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps working when the browser cannot save the reply", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(guestEvent(baseInput, null, true)))
        .mockResolvedValueOnce(json({ replyId: "rabc123", secret: "S".repeat(22) })),
    );
    render(<GuestReply token={TOKEN} />);
    await user.type(await screen.findByLabelText("Your name"), "Ravi");
    await user.click(screen.getByRole("radio", { name: "Sorry, can't come" }));
    await user.click(screen.getByRole("button", { name: "Send my reply" }));
    expect(await screen.findByRole("heading", { name: "Thank you, Ravi!" })).toBeInTheDocument();
  });
});
