// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
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

describe("VoiceStart recording", () => {
  class FakeRecorder {
    static isTypeSupported = () => true;
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(public stream: { getTracks: () => { stop: () => void }[] }) {}
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob([new Uint8Array(2000)], { type: "audio/webm" }) });
      this.onstop?.();
    }
  }

  it("records a voice note and sends it as audio", async () => {
    const stopTrack = vi.fn();
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
      configurable: true,
    });
    const onSubmit = vi.fn();
    render(<VoiceStart busy={false} error="" onSubmit={onSubmit} onUseForm={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Start recording a voice note" }));
    expect(await screen.findByRole("button", { name: "Stop recording" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/seconds left/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].audio.mimeType).toBe("audio/webm");
    expect(stopTrack).toHaveBeenCalled();
  });

  it("explains when the microphone is blocked", async () => {
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    render(<VoiceStart busy={false} error="" onSubmit={vi.fn()} onUseForm={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Start recording a voice note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/allow microphone access/);
  });
});
