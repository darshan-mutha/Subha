// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceStart } from "@/components/VoiceStart";
import { Planner } from "@/components/Planner";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe("VoiceStart", () => {
  it("falls back to typing when the browser cannot record", async () => {
    const onSubmit = vi.fn();
    render(<VoiceStart busy={false} error="" onSubmit={onSubmit} onUseForm={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /recording/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Describe your event/), "Birthday in Pune, 30 guests, 40k");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith({ text: "Birthday in Pune, 30 guests, 40k" });
  });

  it("asks for more detail when the message is too short", async () => {
    const onSubmit = vi.fn();
    render(<VoiceStart busy={false} error="" onSubmit={onSubmit} onUseForm={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Describe your event/), "party");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/a little more/);
  });

  it("offers the form as a fallback", async () => {
    const onUseForm = vi.fn();
    render(<VoiceStart busy={false} error="" onSubmit={vi.fn()} onUseForm={onUseForm} />);
    await userEvent.click(screen.getByRole("button", { name: /Fill in the details yourself/ }));
    expect(onUseForm).toHaveBeenCalled();
  });

  it("fills the box from an example and sends with Enter", async () => {
    const onSubmit = vi.fn();
    render(<VoiceStart busy={false} error="" onSubmit={onSubmit} onUseForm={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "3-day wedding in Jaipur" }));
    const box = screen.getByLabelText(/Describe your event/);
    expect((box as HTMLTextAreaElement).value).toMatch(/^3-day wedding in Jaipur on 14 February/);
    box.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({ text: expect.stringContaining("pheras on day 3") });
  });
});

describe("Planner voice-first flow", () => {
  it("fills the form from what Shubā understood and highlights missing details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            transcript: "Housewarming in Mysuru for 60 people",
            values: {
              eventType: "housewarming",
              eventName: "",
              date: "",
              city: "Mysuru",
              guests: "60",
              budget: "",
              style: "",
              notes: "",
              includeMuhurat: true,
            },
            missing: ["date", "budget"],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    render(<Planner />);
    await userEvent.type(screen.getByLabelText(/Describe your event/), "Housewarming in Mysuru for 60 people");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(screen.getByText(/Shubā heard/)).toBeInTheDocument());
    expect(screen.getByLabelText(/City/)).toHaveValue("Mysuru");
    expect(screen.getByLabelText(/Number of guests/)).toHaveValue(60);
    expect(screen.getByLabelText(/Date/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/Total budget/)).toHaveAccessibleDescription(/didn't catch/);
    expect(screen.getByRole("checkbox", { name: /auspicious/ })).toBeChecked();
  });
});

describe("VoiceStart speech to text", () => {
  type Handler = Record<string, ((e?: unknown) => void) | null>;
  let last: (Handler & { lang: string; started: boolean; stop: () => void }) | null = null;

  class FakeRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    started = false;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() {
      last = this as unknown as typeof last;
    }
    start() {
      this.started = true;
    }
    stop() {
      this.onend?.();
    }
    abort() {}
  }

  it("shows a calm listening sign while speaking, then puts the words in the box", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    const onSubmit = vi.fn();
    render(<VoiceStart busy={false} error="" onSubmit={onSubmit} onUseForm={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Describe your event/), "Birthday in Pune");
    await userEvent.selectOptions(screen.getByLabelText("Speaking in"), "hi-IN");
    await userEvent.click(screen.getByRole("button", { name: "Speak about your event" }));
    expect(last!.lang).toBe("hi-IN");
    expect(screen.getByRole("status")).toHaveTextContent(/Listening… 0:00/);
    // The ticking clock is visible but hidden from screen readers, so the status is not re-read every second.
    expect(screen.getByText("0:00")).toHaveAttribute("aria-hidden", "true");
    const heard = (words: string, isFinal: boolean) => Object.assign([{ transcript: words }], { isFinal });
    act(() => last!.onresult!({ resultIndex: 0, results: [heard("for 30 people,", true)] }));
    act(() => last!.onresult!({ resultIndex: 1, results: [heard("for 30 people,", true), heard("budget 4", false)] }));
    // Half-heard words are not shown while the host is still talking.
    expect(screen.queryByText(/budget 4/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Describe your event/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop listening" }));
    expect(screen.getByLabelText(/Describe your event/)).toHaveValue("Birthday in Pune for 30 people, budget 4");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith({ text: "Birthday in Pune for 30 people, budget 4" });
  });

  it("explains when the microphone is blocked or nothing was heard", async () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    render(<VoiceStart busy={false} error="" onSubmit={vi.fn()} onUseForm={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Speak about your event" }));
    act(() => last!.onerror!({ error: "not-allowed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/allow microphone access/);
    await userEvent.click(screen.getByRole("button", { name: "Speak about your event" }));
    act(() => last!.onerror!({ error: "no-speech" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't hear anything/);
    await userEvent.click(screen.getByRole("button", { name: "Speak about your event" }));
    act(() => last!.onerror!({ error: "network" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Listening stopped/);
  });
});
