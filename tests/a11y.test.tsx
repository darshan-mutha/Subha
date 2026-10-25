// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/EventForm";
import { PlanWorkspace } from "@/components/PlanWorkspace";
import { VoiceStart } from "@/components/VoiceStart";
import { baseInput, samplePlan } from "./fixtures";

/** Runs axe-core (WCAG 2.2 A/AA). Colour contrast is checked in the browser scan, as jsdom has no layout. */
async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

describe("accessibility (axe-core)", () => {
  it("voice start has no violations", async () => {
    const { container } = render(<VoiceStart busy={false} error="" onSubmit={vi.fn()} onUseForm={vi.fn()} />);
    expect(await violations(container)).toEqual([]);
  });

  it("form with errors has no violations", async () => {
    const { container } = render(
      <EventForm busy={false} initialErrors={{ city: "Please enter a city" }} onSubmit={vi.fn()} />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("budget helper with three options has no violations", async () => {
    const { container } = render(<EventForm busy={false} onSubmit={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText(/Event type/), "wedding");
    await userEvent.type(screen.getByLabelText(/Number of guests/), "150");
    await userEvent.click(screen.getByRole("button", { name: "Not sure? Help me decide" }));
    expect(await violations(container)).toEqual([]);
  });

  it("plan workspace with a team has no violations", async () => {
    const { container } = render(
      <PlanWorkspace
        planKey="test"
        data={{
          input: baseInput,
          plan: samplePlan,
          timings: null,
          team: [{ id: "mravi", name: "Ravi", role: "cousin" }],
          assignments: {},
          done: {},
        }}
        shareUrl="https://shuba.example/p/abc"
        onChange={vi.fn()}
        onToggle={vi.fn()}
        onShare={null}
        onEdit={vi.fn()}
        onStartOver={vi.fn()}
        viewer=""
        onViewerChange={vi.fn()}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });
});
