"use client";

import { formatINR } from "@/lib/budget";
import { judgeQuote, type Quote } from "@/lib/deals";

/** Quotes for one vendor, cheapest first, with Book and Remove actions. */
export function QuoteList({
  vendorType,
  quotes,
  bookedId,
  available,
  onBook,
  onRemove,
}: {
  vendorType: string;
  quotes: Quote[];
  bookedId: string;
  /** Money available for this vendor, or null when no budget line matches. */
  available: number | null;
  onBook: (quoteId: string) => void;
  onRemove: (quoteId: string) => void;
}) {
  const cheapest = quotes[0]?.id;
  if (quotes.length === 0) {
    return <p className="muted small">No quotes yet. Add the quotes you receive here to compare them side by side.</p>;
  }
  return (
    <ul className="quote-list" aria-label={`Quotes for ${vendorType}, cheapest first`}>
      {quotes.map((q) => {
        const verdict = available !== null ? judgeQuote(q.amount, available) : null;
        const isBooked = bookedId === q.id;
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
                  onClick={() => onBook(q.id)}
                  aria-label={`Book ${q.vendorName} for ${formatINR(q.amount)}`}
                >
                  Book
                </button>
              )}
              <button
                type="button"
                className="btn btn-small btn-link"
                onClick={() => onRemove(q.id)}
                aria-label={`Remove quote from ${q.vendorName}`}
              >
                Remove
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
