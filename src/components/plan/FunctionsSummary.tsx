"use client";

import type { Plan } from "@/lib/schemas";
import { shortDate } from "@/lib/schedule";
import { functionCount, type GuestList } from "@/lib/guestList";
import { dateOfDay, dayLabel } from "@/lib/traditions";

/** A short day-by-day list of functions for the Home section. */
export function FunctionsSummary({
  plan,
  firstDay,
  onOpen,
  entries = [],
}: {
  plan: Plan;
  firstDay: string;
  onOpen: () => void;
  entries?: GuestList;
}) {
  const invited = (fn: string) =>
    entries.length ? ` (${functionCount(entries, [], fn).invited.toLocaleString("en-IN")} invited)` : "";
  const days = [...new Set(plan.functions.map((f) => f.day))].sort((a, b) => a - b);
  if (days.length === 0) return null;
  return (
    <section className="fn-summary" aria-labelledby="fn-summary-heading">
      <h2 id="fn-summary-heading" className="small-heading">
        Your functions
      </h2>
      <ul className="list">
        {days.map((day) => {
          const date = dateOfDay(firstDay, day);
          return (
            <li key={day}>
              <strong>
                {dayLabel(day)}
                {date ? `, ${shortDate(date)}` : ""}:
              </strong>{" "}
              {plan.functions
                .filter((f) => f.day === day)
                .map((f) => `${f.name}${invited(f.name)}`)
                .join(", ")}
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-small no-print" onClick={onOpen}>
        See all functions
      </button>
    </section>
  );
}
