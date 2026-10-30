"use client";

import { formatShortINR } from "@/lib/budget";
import { shortName, type VendorSummary } from "@/lib/vendorSummary";

const pct = (n: number, of: number) => (of ? `${(n / of) * 100}%` : "0%");

/** The strip at the top: how many are booked, the money, and which vendor to book next. */
export function Summary({ s, onOpen }: { s: VendorSummary; onOpen: (id: string) => void }) {
  const next = s.next;
  return (
    <section className="vb-summary card-inner" aria-label="Vendor summary">
      <div className="vb-count">
        <p className="vb-big">
          {s.booked.length} of {s.needed} booked
        </p>
        <div
          className="vs-bar"
          role="img"
          aria-label={`${s.booked.length} booked, ${s.gettingQuotes.length} getting quotes, ${s.notStarted.length} not started, out of ${s.needed}`}
        >
          <span className="vs-bar-booked" style={{ width: pct(s.booked.length, s.needed) }} />
          <span className="vs-bar-quotes" style={{ width: pct(s.gettingQuotes.length, s.needed) }} />
        </div>
      </div>
      <dl className="vb-money">
        <div>
          <dt>Vendor budget</dt>
          <dd>{formatShortINR(s.vendorBudget)}</dd>
        </div>
        <div>
          <dt>Booked</dt>
          <dd className={s.payments.committed > s.vendorBudget ? "over-budget" : undefined}>
            {formatShortINR(s.payments.committed)}
          </dd>
        </div>
        <div>
          <dt>Balance due</dt>
          <dd>{formatShortINR(s.payments.balanceDue)}</dd>
        </div>
      </dl>
      {next ? (
        <p className={`vb-next${next.overdue ? " is-late" : ""}`}>
          <span>
            {next.overdue ? "Overdue" : "Book next"} · <strong>{shortName(next.type)}</strong>
          </span>
          <button
            type="button"
            className="btn btn-small btn-primary no-print"
            onClick={() => onOpen(next.id)}
            aria-label={`Open ${shortName(next.type)}`}
          >
            Open
          </button>
        </p>
      ) : (
        s.needed > 0 && (
          <p className="vb-next is-done">
            <strong>All vendors booked.</strong> Keep track of advances and balances here.
          </p>
        )
      )}
    </section>
  );
}
