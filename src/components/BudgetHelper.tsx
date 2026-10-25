"use client";

import { formatINR } from "@/lib/budget";
import { formatShortINR, suggestBudgets, type BudgetOption } from "@/lib/budgetGuide";
import { EVENT_TYPE_LABELS, LIMITS, type EventType } from "@/lib/schemas";

interface Props {
  id: string;
  eventType: EventType | "";
  guests: string;
  city: string;
  /** Budget currently in the form, to mark the matching option. */
  current: string;
  onPick: (option: BudgetOption) => void;
  onClose: () => void;
}

/** Panel shown when the host taps "Not sure? Help me decide" under the budget box. */
export function BudgetHelper({ id, eventType, guests, city, current, onPick, onClose }: Props) {
  const guestCount = Number(guests);
  const ready =
    eventType !== "" &&
    guests !== "" &&
    Number.isInteger(guestCount) &&
    guestCount >= LIMITS.minGuests &&
    guestCount <= LIMITS.maxGuests;

  return (
    <section id={id} className="budget-helper" aria-labelledby={`${id}-title`}>
      <div className="budget-helper-head">
        <h3 id={`${id}-title`}>Not sure what to spend? Pick a level</h3>
        <button type="button" className="btn btn-link btn-small" onClick={onClose}>
          Close
        </button>
      </div>

      {!ready ? (
        <p className="hint" role="status">
          Choose the <strong>event type</strong> and <strong>number of guests</strong> above, and we&rsquo;ll suggest
          three budgets.
        </p>
      ) : (
        <>
          <p className="hint">
            For a {EVENT_TYPE_LABELS[eventType].toLowerCase()} with {guestCount.toLocaleString("en-IN")} guests
            {city.trim() ? ` in ${city.trim()}` : ""}. Rough estimates only — real quotes will vary.
          </p>
          <ul className="budget-options" role="list">
            {suggestBudgets({ eventType, guests: guestCount, city }).map((opt) => {
              const chosen = Number(current) === opt.suggested;
              return (
                <li key={opt.tier} className={`budget-option${chosen ? " is-chosen" : ""}`}>
                  <h4>{opt.label}</h4>
                  <p className="budget-range">
                    {formatShortINR(opt.low)} – {formatShortINR(opt.high)}
                  </p>
                  <p className="muted small">About {formatINR(opt.perGuest)} per guest</p>
                  <ul className="budget-includes">
                    {opt.includes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`btn btn-small${chosen ? " btn-primary" : ""}`}
                    aria-pressed={chosen}
                    onClick={() => onPick(opt)}
                  >
                    {chosen && <span aria-hidden="true">✓ </span>}Use {formatShortINR(opt.suggested)}
                    <span className="sr-only"> ({opt.label})</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
