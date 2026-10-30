"use client";

import { useId, useState, type FormEvent } from "react";
import { formatINR } from "@/lib/budget";
import { ApiError, requestAgreement } from "@/lib/client";
import {
  MAX_AGREEMENT,
  MAX_QUOTES,
  QuoteSchema,
  bookedQuote,
  budgetForVendor,
  emptyDeal,
  judgeQuote,
  newQuoteId,
  sortedQuotes,
  type Deal,
  type Deals,
  type VendorRef,
} from "@/lib/deals";
import { fieldErrors, type EventInput, type Plan } from "@/lib/schemas";
import { whatsappLink } from "@/lib/team";
import { CopyButton } from "./PlanSections";

/** Everything the vendor cards need to manage quotes and bookings. */
export interface DealState {
  deals: Deals;
  input: EventInput;
  budget: Plan["budget"];
  vendors: VendorRef[];
  /** Saves one vendor's deal. May reject (e.g. offline); the card shows the error. */
  onDeal: (vendorId: string, deal: Deal) => Promise<void>;
  /** Ticks or unticks the vendor's "Book …" item, so progress stays in step. */
  onBooked: (vendorId: string, booked: boolean) => void;
}

/** wa.me needs digits with country code; 10-digit Indian numbers get +91. */
export function vendorWhatsApp(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10 ? `91${digits}` : digits.length >= 11 ? digits : "";
  const base = whatsappLink(text);
  return number ? base.replace("https://wa.me/", `https://wa.me/${number}`) : base;
}

function printAgreement(id: string) {
  const body = document.body;
  body.dataset.print = "agreement";
  document.getElementById(id)?.classList.add("print-this");
  const done = () => {
    delete body.dataset.print;
    document.getElementById(id)?.classList.remove("print-this");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

const BLANK = { vendorName: "", phone: "", amount: "", includes: "" };

/** Which part to show: "compare" (quotes) or "book" (booking, payments, agreement). */
export type DealPart = "compare" | "book";

export function VendorDeal({
  vendor,
  brief,
  state,
  part,
  onStep,
}: {
  vendor: VendorRef;
  brief: string;
  state: DealState;
  part: DealPart;
  /** Moves the vendor screen to another step, e.g. to the booking after "Book". */
  onStep?: (part: DealPart) => void;
}) {
  const uid = useId();
  const deal = state.deals[vendor.id] ?? emptyDeal();
  const quotes = sortedQuotes(deal);
  const booked = bookedQuote(deal);
  const money = budgetForVendor(vendor, state.vendors, state.deals, state.budget);
  const cheapest = quotes[0]?.id;

  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [advance, setAdvance] = useState(String(deal.advance || ""));
  const [agreement, setAgreement] = useState(deal.agreement);

  // Follow changes made by others on a shared plan (adjusting state during render, not in an effect).
  const [seen, setSeen] = useState({ advance: deal.advance, agreement: deal.agreement });
  if (seen.advance !== deal.advance || seen.agreement !== deal.agreement) {
    setSeen({ advance: deal.advance, agreement: deal.agreement });
    if (seen.advance !== deal.advance) setAdvance(String(deal.advance || ""));
    if (seen.agreement !== deal.agreement) setAgreement(deal.agreement);
  }

  async function save(next: Deal, message: string) {
    setError("");
    try {
      await state.onDeal(vendor.id, next);
      setStatus(message);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
      return false;
    }
  }

  async function addQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = QuoteSchema.safeParse({ ...form, id: newQuoteId() });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    if (await save({ ...deal, quotes: [...deal.quotes, parsed.data] }, `Quote from ${parsed.data.vendorName} added`)) {
      setForm(BLANK);
      setAdding(false);
    }
  }

  async function book(quoteId: string) {
    const quote = deal.quotes.find((q) => q.id === quoteId);
    if (!quote) return;
    const ok = await save(
      { ...deal, booked: quoteId, advance: Math.min(deal.advance, quote.amount), agreement: "" },
      `${quote.vendorName} booked`,
    );
    if (ok) {
      state.onBooked(vendor.id, true);
      onStep?.("book");
    }
  }

  async function cancelBooking() {
    if (await save({ ...deal, booked: "", advance: 0, agreement: "" }, "Booking cancelled")) {
      state.onBooked(vendor.id, false);
    }
  }

  async function removeQuote(quoteId: string) {
    const isBooked = deal.booked === quoteId;
    const next = { ...deal, quotes: deal.quotes.filter((q) => q.id !== quoteId) };
    if (isBooked) Object.assign(next, { booked: "", advance: 0, agreement: "" });
    if ((await save(next, "Quote removed")) && isBooked) state.onBooked(vendor.id, false);
  }

  async function saveAdvance() {
    const value = Math.max(0, Math.round(Number(advance) || 0));
    if (!booked || value === deal.advance) return;
    if (value > booked.amount) {
      setError(`The advance can't be more than the agreed price of ${formatINR(booked.amount)}.`);
      return;
    }
    await save({ ...deal, advance: value }, "Advance saved");
  }

  async function draft() {
    if (!booked) return;
    setDrafting(true);
    setError("");
    setStatus("Drafting the agreement…");
    try {
      const result = await requestAgreement({
        input: state.input,
        vendor: { type: vendor.type, brief },
        quote: booked,
        advance: deal.advance,
      });
      setAgreement(result.text);
      await save(
        { ...deal, agreement: result.text },
        result.source === "ai" ? "Agreement drafted" : "Shubā was busy, so it used standard wording. Agreement ready.",
      );
    } catch (e) {
      setStatus("");
      setError(e instanceof ApiError ? e.message : "Could not draft the agreement. Please try again.");
    } finally {
      setDrafting(false);
    }
  }

  async function saveAgreement() {
    if (agreement === deal.agreement) return;
    await save({ ...deal, agreement }, "Agreement saved");
  }

  const agreementId = `${uid}-agreement`;

  return (
    <div className="deal">
      {part === "compare" && (
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
              onChange={(e) => void save({ ...deal, budgetCategory: e.target.value }, "Budget line changed")}
            >
              <option value="">Choose a budget line</option>
              {state.budget.map((l) => (
                <option key={l.category} value={l.category}>
                  {l.category}
                </option>
              ))}
            </select>
          </div>

          {quotes.length === 0 ? (
            <p className="muted small">No quotes yet. Add the quotes you receive here to compare them side by side.</p>
          ) : (
            <ul className="quote-list" aria-label={`Quotes for ${vendor.type}, cheapest first`}>
              {quotes.map((q) => {
                const verdict = money ? judgeQuote(q.amount, money.available) : null;
                const isBooked = deal.booked === q.id;
                return (
                  <li key={q.id} className={`quote-item${isBooked ? " quote-booked" : ""}`}>
                    <div className="quote-main">
                      <span className="quote-name">
                        {q.vendorName}
                        {q.id === cheapest && quotes.length > 1 && <span className="badge quote-low">Lowest</span>}
                        {isBooked && <span className="badge badge-must">Booked</span>}
                      </span>
                      {q.includes && <span className="muted small">{q.includes}</span>}
                    </div>
                    <div className="quote-money">
                      <strong>{formatINR(q.amount)}</strong>
                      {verdict && <span className={`verdict verdict-${verdict.kind}`}>{verdict.text}</span>}
                    </div>
                    <div className="quote-actions no-print">
                      {!isBooked && (
                        <button
                          type="button"
                          className="btn btn-small btn-primary"
                          onClick={() => void book(q.id)}
                          aria-label={`Book ${q.vendorName} for ${formatINR(q.amount)}`}
                        >
                          Book
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-small btn-link"
                        onClick={() => void removeQuote(q.id)}
                        aria-label={`Remove quote from ${q.vendorName}`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {deal.quotes.length < MAX_QUOTES &&
            (adding ? (
              <form className="quote-form no-print" onSubmit={addQuote} noValidate>
                <div className="field">
                  <label htmlFor={`${uid}-name`}>Vendor name</label>
                  <input
                    id={`${uid}-name`}
                    type="text"
                    value={form.vendorName}
                    maxLength={60}
                    aria-invalid={Boolean(errors.vendorName)}
                    aria-describedby={errors.vendorName ? `${uid}-name-err` : undefined}
                    onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  />
                  {errors.vendorName && (
                    <span id={`${uid}-name-err`} className="field-error">
                      {errors.vendorName}
                    </span>
                  )}
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-amount`}>Quoted price (₹)</label>
                  <input
                    id={`${uid}-amount`}
                    type="text"
                    inputMode="numeric"
                    value={form.amount}
                    aria-invalid={Boolean(errors.amount)}
                    aria-describedby={errors.amount ? `${uid}-amount-err` : undefined}
                    onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })}
                  />
                  {errors.amount && (
                    <span id={`${uid}-amount-err`} className="field-error">
                      {errors.amount}
                    </span>
                  )}
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-phone`}>Phone (optional)</label>
                  <input
                    id={`${uid}-phone`}
                    type="tel"
                    value={form.phone}
                    maxLength={20}
                    aria-invalid={Boolean(errors.phone)}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  {errors.phone && <span className="field-error">{errors.phone}</span>}
                </div>
                <div className="field field-wide">
                  <label htmlFor={`${uid}-includes`}>What&apos;s included (optional)</label>
                  <input
                    id={`${uid}-includes`}
                    type="text"
                    value={form.includes}
                    maxLength={300}
                    placeholder="e.g. Veg buffet, 2 sweets, serving staff"
                    aria-invalid={Boolean(errors.includes)}
                    onChange={(e) => setForm({ ...form, includes: e.target.value })}
                  />
                  {errors.includes && <span className="field-error">{errors.includes}</span>}
                </div>
                <div className="row">
                  <button type="submit" className="btn btn-primary btn-small">
                    Add quote
                  </button>
                  <button type="button" className="btn btn-link btn-small" onClick={() => setAdding(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="btn btn-small no-print" onClick={() => setAdding(true)}>
                + Add a quote
              </button>
            ))}
        </>
      )}

      {part === "book" && !booked && (
        <div className="booking-empty">
          <p className="muted small">
            Not booked yet. Compare the quotes and tap <strong>Book</strong> on the one you choose. The advance, balance
            and booking confirmation then show here.
          </p>
          {onStep && (
            <button type="button" className="btn btn-small" onClick={() => onStep("compare")}>
              Compare quotes
            </button>
          )}
        </div>
      )}

      {part === "book" && booked && (
        <div className="booking">
          <h3 className="small-heading">Booking</h3>
          <p>
            Booked <strong>{booked.vendorName}</strong> for <strong>{formatINR(booked.amount)}</strong>
          </p>
          <div className="row small no-print">
            <label htmlFor={`${uid}-advance`}>Advance paid (₹)</label>
            <input
              id={`${uid}-advance`}
              type="text"
              className="advance-input"
              inputMode="numeric"
              value={advance}
              onChange={(e) => setAdvance(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => void saveAdvance()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveAdvance();
              }}
            />
          </div>
          <p className="small">
            Advance paid {formatINR(Math.min(deal.advance, booked.amount))} · Balance due{" "}
            <strong>{formatINR(booked.amount - Math.min(deal.advance, booked.amount))}</strong>
          </p>
          <div className="row no-print">
            <button
              type="button"
              className="btn btn-small btn-primary"
              onClick={() => void draft()}
              disabled={drafting}
            >
              {drafting ? "Drafting…" : deal.agreement ? "Redraft agreement" : "Draft agreement"}
            </button>
            <button type="button" className="btn btn-small btn-link" onClick={() => void cancelBooking()}>
              Cancel booking
            </button>
          </div>

          {(agreement || deal.agreement) && (
            <div className="agreement" id={agreementId}>
              <label htmlFor={`${agreementId}-text`} className="small-heading">
                Agreement draft (you can edit it)
              </label>
              <textarea
                id={`${agreementId}-text`}
                rows={14}
                maxLength={MAX_AGREEMENT}
                value={agreement}
                onChange={(e) => setAgreement(e.target.value)}
                onBlur={() => void saveAgreement()}
              />
              <pre className="agreement-print" aria-hidden="true">
                {agreement}
              </pre>
              <p className="note small">A simple draft, not legal advice. Read it with the vendor before signing.</p>
              <div className="row no-print">
                <CopyButton text={agreement} label="agreement" />
                <a
                  className="btn btn-small"
                  href={vendorWhatsApp(booked.phone, agreement)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Send to {booked.vendorName} on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                </a>
                <button type="button" className="btn btn-small" onClick={() => printAgreement(agreementId)}>
                  Download PDF / Print
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="form-error small" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
