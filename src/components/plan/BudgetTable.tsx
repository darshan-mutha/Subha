"use client";

import { formatINR } from "@/lib/budget";
import type { PaymentSummary } from "@/lib/deals";
import type { Plan } from "@/lib/schemas";
import { AmountInput } from "./AmountInput";

function BookedCell({ planned, spent }: { planned: number; spent: number }) {
  if (spent === 0) return <td className="num muted">–</td>;
  const over = spent - planned;
  return (
    <td className="num">
      {formatINR(spent)}
      {over > 0 && <span className="over-budget small"> ({formatINR(over)} over)</span>}
    </td>
  );
}

/** Totals for booked vendors: booked, advance paid, balance due and what is left. */
export function PaymentsSummary({ payments, total }: { payments: PaymentSummary; total: number }) {
  return (
    <>
      <h3>Vendor bookings</h3>
      <dl className="payments">
        <div>
          <dt>Booked</dt>
          <dd>{formatINR(payments.committed)}</dd>
        </div>
        <div>
          <dt>Advance paid</dt>
          <dd>{formatINR(payments.advancePaid)}</dd>
        </div>
        <div>
          <dt>Balance due</dt>
          <dd>{formatINR(payments.balanceDue)}</dd>
        </div>
        <div>
          <dt>Left in budget</dt>
          <dd className={payments.committed > total ? "over-budget" : undefined}>
            {formatINR(total - payments.committed)}
          </dd>
        </div>
      </dl>
      <p className="small muted">
        {payments.bookedCount} vendor{payments.bookedCount === 1 ? "" : "s"} booked. All other amounts are estimates
        until you book.
      </p>
    </>
  );
}

/** The budget table: one row per line with amount, share and (optionally) booked spend. */
export function BudgetTable({
  plan,
  total,
  booked,
  payments,
  showBooked,
  onCommit,
}: {
  plan: Plan;
  total: number;
  booked?: Map<string, number>;
  payments?: PaymentSummary;
  showBooked: boolean;
  /** When set, amounts are editable. */
  onCommit?: (index: number, amount: number) => void;
}) {
  const max = Math.max(...plan.budget.map((b) => b.amount), 1);
  return (
    <div className="table-wrap">
      <table className="budget-table">
        <caption className="sr-only">Estimated budget by category, total {formatINR(total)}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" className="num">
              Amount
            </th>
            <th scope="col" className="num share-col">
              Share
            </th>
            {showBooked && (
              <th scope="col" className="num">
                Booked
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {plan.budget.map((line, index) => {
            const share = Math.round((line.amount / total) * 100);
            return (
              <tr key={line.category}>
                <th scope="row">
                  <span className="cat">{line.category}</span>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${(line.amount / max) * 100}%` }} />
                  </span>
                  {line.note && <span className="muted small">{line.note}</span>}
                </th>
                <td className="num">
                  {onCommit ? <AmountInput line={line} index={index} onCommit={onCommit} /> : formatINR(line.amount)}
                </td>
                <td className="num share-col">{share}%</td>
                {showBooked && <BookedCell planned={line.amount} spent={booked?.get(line.category) ?? 0} />}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="num">{formatINR(total)}</td>
            <td className="num share-col">100%</td>
            {showBooked && payments && <BookedCell planned={total} spent={payments.committed} />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
