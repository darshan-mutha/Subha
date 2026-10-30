"use client";

import { useRef, useState } from "react";

/** Which plan section is open, and how to move to one (scrolling and focusing it). */
export function useSectionNav(initialTab: string) {
  const [tab, setTab] = useState(initialTab);
  /** The box holding the section navigation and every section panel. */
  const tabsRef = useRef<HTMLDivElement>(null);

  /** Finds an element inside the sections box (not the whole page). */
  const inSections = (selector: string) => tabsRef.current?.querySelector<HTMLElement>(selector) ?? null;

  /** Opens a section, brings it into view if it is off screen, and moves focus to it. */
  function goTo(id: string) {
    setTab(id);
    requestAnimationFrame(() => {
      const box = tabsRef.current;
      if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView?.({ block: "start" });
      inSections(`[id="section-${id}"]`)?.focus({ preventScroll: true });
    });
  }

  /** Opens the Budget tab at the over-budget choices. */
  function showChoices() {
    setTab("budget");
    requestAnimationFrame(() => {
      const heading = inSections("[data-savings-heading]");
      heading?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      heading?.focus({ preventScroll: true });
    });
  }

  return { tab, tabsRef, goTo, showChoices };
}
