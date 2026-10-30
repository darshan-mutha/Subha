"use client";

import { useState } from "react";
import { formatINR, rebalance } from "@/lib/budget";
import type { PaymentSummary } from "@/lib/deals";
import type { Plan } from "@/lib/schemas";
import { BudgetTable, PaymentsSummary } from "./BudgetTable";

/** The budget split: editable amounts that rebalance to keep the total, plus bookings and tips. */
export function BudgetSection({
  plan,
  total,
  booked,
  payments,
  onBudgetChange,
}: {
  plan: Plan;
  total: number;
  /** Booked vendor amounts per budget line. */
  booked?: Map<string, number>;
  payments?: PaymentSummary;
  /** When set, the host can change amounts; the rest rebalance to keep the total. */
  onBudgetChange?: (lines: Plan["budget"]) => void;
}) {
  const [status, setStatus] = useState("");
  const commit = (index: number, amount: number) => {
    if (!onBudgetChange) return;
    const line = plan.budget[index];
    const next = rebalance(plan.budget, index, amount, total);
    const moved = next[index].amount - line.amount;
    onBudgetChange(next);
    setStatus(
      moved === 0
        ? ""
        : `${line.category} ${moved > 0 ? "up" : "down"} by ${formatINR(Math.abs(moved))}. The other lines ${
            moved > 0 ? "gave up" : "gained"
          } ${formatINR(Math.abs(moved))} between them, so the total stays ${formatINR(total)}.`,
    );
  };
  const showBooked = Boolean(payments && payments.bookedCount > 0);
  const unmatched = booked?.get("Other") ?? 0;
  return (
    <>
      <h2 className="section-title">Budget split</h2>
      <p className="hint estimate-note">
        All amounts are estimates to plan with, not vendor quotes. Confirm prices before you book.
        {onBudgetChange && " Change any amount and Shubā moves the difference across the other lines."}
      </p>
      <p role="status" className="small budget-status">
        {status}
      </p>
      {showBooked && payments && <PaymentsSummary payments={payments} total={total} />}
      <BudgetTable
        plan={plan}
        total={total}
        booked={booked}
        payments={payments}
        showBooked={showBooked}
        onCommit={onBudgetChange ? commit : undefined}
      />
      {showBooked && unmatched > 0 && (
        <p className="small muted">
          {formatINR(unmatched)} is booked with vendors not linked to a budget line. Choose a line on the Vendors tab.
        </p>
      )}
      {plan.budgetTips.length > 0 && (
        <>
          <h3>Ways to save</h3>
          <ul className="list">
            {plan.budgetTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
