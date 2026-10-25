"use client";

import { useEffect } from "react";
import { PetalMark, PetalShower } from "./Brand";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * A short, gentle moment when a milestone is reached: one petal fills, a few
 * petals drift down (skipped with reduced motion) and a warm line is announced.
 */
export function Bloom({
  message,
  petal,
  onDone,
  durationMs = 4500,
}: {
  message: string;
  petal: number;
  onDone: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const timer = setTimeout(onDone, durationMs);
    return () => clearTimeout(timer);
  }, [onDone, durationMs]);

  return (
    <div className="bloom" role="status">
      {!prefersReducedMotion() && <PetalShower />}
      <PetalMark size={40} filled={petal} blooming={petal} />
      <p>{message}</p>
      <button type="button" className="btn btn-small btn-link" onClick={onDone}>
        Close
      </button>
    </div>
  );
}
