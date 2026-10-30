// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddGuests } from "@/components/AddGuests";
import type { GuestEntry } from "@/lib/guestList";
import { baseInput } from "./fixtures";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const twoGroups = {
  groups: [
    { name: "Close family", about: 25, who: "Grandparents, uncles, aunts", side: "family" },
    { name: "Friends", about: 15, who: "School friends", side: "friends" },
  ],
  reminders: [],
  source: "standard",
};

/** Gives this browser a contact picker (navigator.contacts) that returns what `select` gives. */
function withContacts(select: () => Promise<{ name?: string[]; tel?: string[] }[]>) {
  Object.defineProperty(navigator, "contacts", { configurable: true, value: { select: vi.fn(select) } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "contacts");
});

function setup(onCancel: (() => void) | null = vi.fn()) {
  const user = userEvent.setup();
  const onAdd = vi.fn<(entries: GuestEntry[]) => void>();
  render(<AddGuests input={baseInput} functions={[]} onAdd={onAdd} onCancel={onCancel} />);
  return { user, onAdd };
}

describe("Add guests: paste a list", () => {
  it("reads a list, skips lines without a name, leaves one out and adds the rest", async () => {
    const onCancel = vi.fn();
    const { user, onAdd } = setup(onCancel);
    expect(screen.queryByRole("button", { name: /Pick from my contacts/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onCancel).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Paste a list/ }));
    expect(screen.getByRole("heading", { name: "Add guests" })).toBeInTheDocument();
    const box = screen.getByLabelText(/Paste or type names/);
    await waitFor(() => expect(box).toHaveFocus());
    expect(screen.getByRole("button", { name: "Read my list" })).toBeDisabled();

    await user.type(box, "Sharma family 4{enter}!!!{enter}Kapoor family 3");
    await user.click(screen.getByRole("button", { name: "Read my list" }));
    expect(screen.getByText(/Found 2 entries, 7 people\. .* Skipped 1 line without a name\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Leave out Kapoor family" }));
    expect(screen.getByText(/Found 1 entry, 4 people/)).toBeInTheDocument();
    const count = screen.getByLabelText("People in Sharma family");
    await user.clear(count);
    await user.type(count, "80");
    await user.click(screen.getByRole("button", { name: "Add this 1" }));
    expect(onAdd).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Sharma family", people: 50, side: "", invitedAt: "" }),
    ]);
  });

  it("says when no names are found, and goes back to edit the text", async () => {
    const { user, onAdd } = setup(null);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Paste a list/ }));
    await user.type(screen.getByLabelText(/Paste or type names/), "!!!{enter}???");
    await user.click(screen.getByRole("button", { name: "Read my list" }));
    expect(screen.getByText(/No names found\. .* Skipped 2 lines without a name\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add these 0" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Edit the text" }));
    expect(screen.getByLabelText(/Paste or type names/)).toHaveValue("!!!\n???");

    await user.click(screen.getByRole("button", { name: "← Other ways to add" }));
    expect(screen.getByRole("heading", { name: "How do you want to add guests?" })).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe("Add guests: one by one", () => {
  it("opens the form and cancels back to the choices", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Add one by one/ }));
    expect(screen.getByLabelText("Name of the family or person")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "How do you want to add guests?" })).toBeInTheDocument();
  });
});

describe("Add guests: help me build it", () => {
  it("shows the loading note, standard groups, and asks only once", async () => {
    let answer: (r: Response) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Help me build it/ }));
    expect(screen.getByText(/Thinking about who to invite/)).toBeInTheDocument();
    answer(json(twoGroups));
    expect(await screen.findByText("Close family · about 25")).toBeInTheDocument();
    expect(screen.getByText(/these are standard groups/)).toBeInTheDocument();
    expect(screen.queryByText(/Don.t forget/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "← Other ways to add" }));
    await user.click(screen.getByRole("button", { name: /Help me build it/ }));
    expect(screen.getByText("Friends · about 15")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the server's message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "Too many requests. Please wait." }, 429)));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Help me build it/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Please wait.");
    expect(screen.queryByText(/Thinking about who to invite/)).not.toBeInTheDocument();
  });

  it("says when the internet is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Help me build it/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach Shubā");
  });

  it("does not pre-pick a side the event has no choice for", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ ...twoGroups, groups: [{ name: "Bride's side", about: 40, who: "Family", side: "bride" }] }),
        ),
    );
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Help me build it/ }));
    await user.click(await screen.findByRole("button", { name: "Add names for Bride's side" }));
    await user.type(screen.getByLabelText(/Names for "Bride's side"/), "Anil");
    await user.click(screen.getByRole("button", { name: "Read my list" }));
    expect(screen.getByLabelText("Side for these (optional)")).toHaveValue("");
  });
});

describe("Add guests: phone contacts", () => {
  it("adds the people picked, keeping only names and clean phone numbers", async () => {
    withContacts(async () => [
      { name: [" Meena Rao 🌸"], tel: ["+91 (98450) 12345"] },
      { name: [""], tel: ["123"] },
      {},
      { name: ["Ravi@work"] },
      { name: ["😀 🎉"] },
    ]);
    const { user, onAdd } = setup();
    await user.click(screen.getByRole("button", { name: /Pick from my contacts/ }));
    expect(await screen.findByText(/Found 2 entries, 2 people/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add these 2" }));
    expect(onAdd).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Meena Rao", phone: "+91 98450 12345", people: 1 }),
      expect.objectContaining({ name: "Raviwork", phone: "", people: 1 }),
    ]);
  });

  it("stays on the choices when nobody is picked", async () => {
    withContacts(async () => []);
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Pick from my contacts/ }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "How do you want to add guests?" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains when the contacts cannot be opened", async () => {
    withContacts(async () => {
      throw new Error("denied");
    });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Pick from my contacts/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not open your contacts");
  });
});
