"use client";

import { formatINR } from "@/lib/budget";
import { MAX_QUOTES, budgetForVendor, sortedQuotes, type VendorRef } from "@/lib/deals";
import { QuoteForm } from "./QuoteForm";
import { QuoteList } from "./QuoteList";
import type { DealState } from "./types";
import type { useVendorDeal } from "./useVendorDeal";

/** The "Compare" step: budget for this vendor, the budget line, quotes and the add-a-quote form. */
export function ComparePart({
  uid,
  vendor,
  state,
  ctl,
}: {
  uid: string;
  vendor: VendorRef;
  state: DealState;
  ctl: ReturnType<typeof useVendorDeal>;
}) {
  const { deal } = ctl;
  const quotes = sortedQuotes(deal);
  const money = budgetForVendor(vendor, state.vendors, state.deals, state.budget);
  return (
    <>
      <h3 className="small-heading">Quotes</h3>
      {money ? (
        <p className="small muted">
          Budget for this: <strong>{formatINR(money.available)}</strong> from “{money.line}”
          {money.usedByOthers > 0 && ` (${formatINR(money.usedByOthers)} already booked with other vendors)`}
        </p>
      ) : (
        <p className="small muted">No matching budget line. Choose one below to compare quotes.</p>
      )}
      <div className="row small">
        <label htmlFor={`${uid}-line`}>Paid from</label>
        <select
          id={`${uid}-line`}
          value={deal.budgetCategory || money?.line || ""}
          onChange={(e) => void ctl.save({ ...deal, budgetCategory: e.target.value }, "Budget line changed")}
        >
          <option value="">Choose a budget line</option>
          {state.budget.map((l) => (
            <option key={l.category} value={l.category}>
              {l.category}
            </option>
          ))}
        </select>
      </div>

      <QuoteList
        vendorType={vendor.type}
        quotes={quotes}
        bookedId={deal.booked}
        available={money ? money.available : null}
        onBook={(id) => void ctl.book(id)}
        onRemove={(id) => void ctl.removeQuote(id)}
      />

      {deal.quotes.length < MAX_QUOTES &&
        (ctl.adding ? (
          <QuoteForm
            uid={uid}
            form={ctl.form}
            errors={ctl.errors}
            onChange={ctl.setForm}
            onSubmit={ctl.addQuote}
            onCancel={() => ctl.setAdding(false)}
          />
        ) : (
          <button type="button" className="btn btn-small no-print" onClick={() => ctl.setAdding(true)}>
            + Add a quote
          </button>
        ))}
    </>
  );
}
