"use client";

import { useId } from "react";
import { rowDetail, rowStatus, shortName, vendorIcon, type VendorRow } from "@/lib/vendorSummary";

/** One vendor in the list: icon, name, where it is up to, and a chevron. */
function Row({
  row,
  selected,
  onOpen,
  rowRef,
}: {
  row: VendorRow;
  selected: boolean;
  onOpen: () => void;
  rowRef: (el: HTMLButtonElement | null) => void;
}) {
  const status = rowStatus(row);
  return (
    <li>
      <button
        type="button"
        ref={rowRef}
        className={`vb-row${selected ? " is-selected" : ""}`}
        aria-current={selected ? "true" : undefined}
        onClick={onOpen}
      >
        <span className="vb-icon" aria-hidden="true">
          {vendorIcon(row.type)}
        </span>
        <span className="vb-name">
          <span className="vb-title">
            {shortName(row.type)}
            {row.mustHave && <span className="vb-must">Must</span>}
          </span>
          <span className="vb-sub">{rowDetail(row)}</span>
        </span>
        <span className={`vb-status is-${status.tone}`}>
          {status.tone === "ok" && <span aria-hidden="true">✓ </span>}
          {status.text}
        </span>
        <span className="vb-chev" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  );
}

/** A titled group of vendor rows ("To book", "Booked"); nothing is shown for an empty group. */
export function Group({
  title,
  rows,
  selected,
  onOpen,
  rowRefs,
}: {
  title: string;
  rows: VendorRow[];
  selected: string;
  onOpen: (id: string) => void;
  rowRefs: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <section className="vb-group" aria-labelledby={id}>
      <h3 className="vb-group-head" id={id}>
        {title} <span className="vb-group-n">{rows.length}</span>
      </h3>
      <ul className="vb-list">
        {rows.map((r) => (
          <Row
            key={r.id}
            row={r}
            selected={r.id === selected}
            onOpen={() => onOpen(r.id)}
            rowRef={(el) => {
              if (el) rowRefs.current.set(r.id, el);
              else rowRefs.current.delete(r.id);
            }}
          />
        ))}
      </ul>
    </section>
  );
}
