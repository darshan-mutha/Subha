"use client";

import { useRef, useState } from "react";
import type { vendorGroups, VendorRow } from "@/lib/vendorSummary";

/**
 * `open` is the vendor the host tapped (phones show it instead of the list).
 * Wider screens always show one vendor beside the list: the tapped one, else the most urgent.
 * Opening moves focus to the vendor's heading; going back returns it to the row.
 */
export function useVendorSelection(rows: VendorRow[], groups: ReturnType<typeof vendorGroups>) {
  const [open, setOpen] = useState("");
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const fallback = groups.toBook[0]?.id ?? groups.booked[0]?.id ?? "";
  const selected = rows.some((r) => r.id === open) ? open : fallback;

  function openVendor(id: string) {
    setOpen(id);
    requestAnimationFrame(() => {
      const heading = headingRef.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      const box = heading.closest("section");
      const top = box?.getBoundingClientRect().top ?? 0;
      if (top < 0 || top > window.innerHeight * 0.5) box?.scrollIntoView?.({ block: "start" });
    });
  }
  function back() {
    const id = open;
    setOpen("");
    requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
  }
  return { open, selected, rowRefs, headingRef, openVendor, back };
}
