"use client";

import { formatINR } from "@/lib/budget";
import {
  FILTER_LABELS,
  VENDOR_FILTERS,
  filterCount,
  nextLine,
  shortName,
  type VendorFilter,
  type VendorSummary,
} from "@/lib/vendorSummary";

interface Props {
  summary: VendorSummary;
  today: string;
  filter: VendorFilter;
  onFilter: (filter: VendorFilter) => void;
}

const pct = (n: number, of: number) => (of ? `${(n / of) * 100}%` : "0%");

/** Dashboard at the top of the Vendors section. Each box also filters the list below. */
export function VendorSummaryPanel({ summary: s, today, filter, onFilter }: Props) {
  const tiles: { filter: VendorFilter; n: number; label: string; sub: string; tone?: "good" | "warn" }[] = [
    {
      filter: "all",
      n: s.needed,
      label: "Needed",
      sub: `${s.mustHave} must-have · ${s.niceToHave} nice-to-have`,
    },
    {
      filter: "booked",
      n: s.booked.length,
      label: "Booked",
      sub: s.booked.length ? s.booked.map((r) => shortName(r.type)).join(", ") : "None yet",
      tone: s.booked.length ? "good" : undefined,
    },
    {
      filter: "quotes",
      n: s.gettingQuotes.length,
      label: "Getting quotes",
      sub: `${s.quotesToCompare} quote${s.quotesToCompare === 1 ? "" : "s"} to compare`,
    },
    {
      filter: "not-started",
      n: s.notStarted.length,
      label: "Not started",
      sub: s.overdue.length
        ? `${s.overdue.length} should be booked by now`
        : s.notStarted.length
          ? "Nothing overdue"
          : "All under way",
      tone: s.overdue.length ? "warn" : undefined,
    },
  ];

  return (
    <section className="vendor-summary" aria-label="Vendor summary">
      <div className="vs-tiles" role="group" aria-label="Show vendors">
        {tiles.map((t) => (
          <button
            key={t.filter}
            type="button"
            className={`vs-tile${t.tone ? ` is-${t.tone}` : ""}`}
            aria-pressed={filter === t.filter}
            onClick={() => onFilter(t.filter)}
          >
            <span className="vs-n">{t.n}</span>
            <span className="vs-l">{t.label}</span>
            <span className="vs-s">{t.sub}</span>
          </button>
        ))}
      </div>

      <div
        className="vs-bar"
        role="img"
        aria-label={`${s.booked.length} booked, ${s.gettingQuotes.length} getting quotes, ${s.notStarted.length} not started, out of ${s.needed}`}
      >
        <span className="vs-bar-booked" style={{ width: pct(s.booked.length, s.needed) }} />
        <span className="vs-bar-quotes" style={{ width: pct(s.gettingQuotes.length, s.needed) }} />
      </div>
      <p className="vs-legend" aria-hidden="true">
        <span>
          <span className="vs-dot vs-bar-booked" />
          Booked {s.booked.length}
        </span>
        <span>
          <span className="vs-dot vs-bar-quotes" />
          Getting quotes {s.gettingQuotes.length}
        </span>
        <span>
          <span className="vs-dot vs-dot-empty" />
          Not started {s.notStarted.length}
        </span>
      </p>

      <dl className="vs-money">
        <div>
          <dt>Vendor budget</dt>
          <dd>{formatINR(s.vendorBudget)}</dd>
        </div>
        <div>
          <dt>Booked so far</dt>
          <dd className={s.payments.committed > s.vendorBudget ? "over-budget" : undefined}>
            {formatINR(s.payments.committed)}
          </dd>
        </div>
        <div>
          <dt>Advance paid</dt>
          <dd>{formatINR(s.payments.advancePaid)}</dd>
        </div>
        <div>
          <dt>Balance due</dt>
          <dd>{formatINR(s.payments.balanceDue)}</dd>
        </div>
      </dl>

      {s.next ? (
        <p className={`vs-next${s.next.overdue ? " is-late" : ""}`}>
          <strong>Book next:</strong> {nextLine(s.next, today)}
        </p>
      ) : (
        s.needed > 0 && (
          <p className="vs-next is-done">
            <strong>All vendors booked.</strong> Keep track of advances and balances below.
          </p>
        )
      )}

      <div className="vs-filters no-print" role="group" aria-label="Filter vendors">
        {VENDOR_FILTERS.filter((f) => f !== "overdue" || s.overdue.length > 0).map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => onFilter(f)}>
            {FILTER_LABELS[f]} {filterCount(s, f)}
          </button>
        ))}
      </div>
    </section>
  );
}
