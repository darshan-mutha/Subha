// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Logo, PetalMark, Toran } from "@/components/Brand";
import { Bloom } from "@/components/Celebrate";

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("brand artwork", () => {
  it("shows the name as text and keeps drawings decorative", () => {
    const { container } = render(<Logo />);
    expect(screen.getByText("Shubā")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("always keeps the first petal gold and fills the rest in turn", () => {
    const { container, rerender } = render(<PetalMark filled={0} />);
    const classes = () => [...container.querySelectorAll(".petal")].map((p) => p.getAttribute("class"));
    expect(classes()[0]).toContain("petal-gold");
    expect(
      classes()
        .slice(1)
        .every((c) => c?.includes("petal-empty")),
    ).toBe(true);
    rerender(<PetalMark filled={2} />);
    expect(classes()[1]).toContain("petal-teal");
    expect(classes()[2]).toContain("petal-gold");
    expect(classes()[3]).toContain("petal-empty");
  });

  it("draws a toran", () => {
    const { container } = render(<Toran />);
    expect(container.querySelectorAll(".toran-gold, .toran-teal").length).toBeGreaterThan(10);
  });
});

describe("Bloom", () => {
  it("announces the milestone with a petal shower, then closes itself", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    const onDone = vi.fn();
    const { container } = render(<Bloom message="Venue booked. The rest gets easier." petal={1} onDone={onDone} />);
    expect(screen.getByRole("status")).toHaveTextContent("Venue booked. The rest gets easier.");
    expect(container.querySelector(".petal-shower")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4500));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("skips the petal shower when reduced motion is on", () => {
    mockReducedMotion(true);
    const { container } = render(<Bloom message="Caterer booked." petal={2} onDone={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Caterer booked.");
    expect(container.querySelector(".petal-shower")).not.toBeInTheDocument();
  });
});
