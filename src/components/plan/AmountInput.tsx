"use client";

import { useState } from "react";
import { formatINR } from "@/lib/budget";
import type { Plan } from "@/lib/schemas";

/** An editable rupee amount for one budget line; commits on blur or Enter. */
export function AmountInput({
  line,
  index,
  onCommit,
}: {
  line: Plan["budget"][number];
  index: number;
  onCommit: (index: number, amount: number) => void;
}) {
  const grouped = (n: number) => n.toLocaleString("en-IN");
  const [draft, setDraft] = useState(grouped(line.amount));
  const [seen, setSeen] = useState(line.amount);
  if (seen !== line.amount) {
    // The amount changed elsewhere (rebalance, AI update, teammate): show the new value.
    setSeen(line.amount);
    setDraft(grouped(line.amount));
  }
  const id = `amount-${index}`;
  const commit = () => {
    const digits = draft.replace(/[^\d]/g, "");
    const value = Number(digits);
    if (digits === "" || value === line.amount) {
      setDraft(grouped(line.amount));
      return;
    }
    onCommit(index, value);
  };
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Amount for {line.category} in rupees
      </label>
      <span className="amount-input no-print">
        <span aria-hidden="true">₹</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      </span>
      <span className="print-only">{formatINR(line.amount)}</span>
    </>
  );
}
