"use client";

import { useRef, useState } from "react";

/** Which plan section is open, and how to move to one (scrolling and focusing it). */
export function useSectionNav(initialTab: string) {
  const [tab, setTab] = useState(initialTab);
  const tabsRef = useRef<HTMLDivElement>(null);

  /** Opens a section, brings it into view if it is off screen, and moves focus to it. */
  function goTo(id: string) {
    setTab(id);
    requestAnimationFrame(() => {
      const box = tabsRef.current;
      if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView?.({ block: "start" });
      document.getElementById(`section-${id}`)?.focus({ preventScroll: true });
    });
  }

  /** Opens the Budget tab at the over-budget choices. */
  function showChoices() {
    setTab("budget");
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("[data-savings-heading]");
      heading?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      heading?.focus({ preventScroll: true });
    });
  }

  return { tab, tabsRef, goTo, showChoices };
}
