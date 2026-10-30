"use client";

import { formatINR } from "@/lib/budget";
import type { Plan } from "@/lib/schemas";
import { shortDate } from "@/lib/schedule";
import { dateOfDay, dayLabel } from "@/lib/traditions";
import { FunctionGuests, type FunctionGuestsProps } from "./FunctionGuests";

/** Functions of a multi-day event, day by day. */
export interface FunctionsProps extends FunctionGuestsProps {
  plan: Plan;
  firstDay: string;
}

function LabelledList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <p className="fn-label">{label}</p>
      <ul className="list small">
        {items.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </>
  );
}

/** One function's card: time, guests, cost, guest-list counts, mood, rituals and needs. */
export function FunctionCard({ fn, guests }: { fn: Plan["functions"][number]; guests: FunctionGuestsProps }) {
  return (
    <article className="card-inner fn-card">
      <h4>{fn.name}</h4>
      <ul className="facts small" aria-label={`${fn.name} details`}>
        {fn.time && <li>{fn.time}</li>}
        {fn.guests > 0 && <li>{fn.guests.toLocaleString("en-IN")} guests</li>}
        {fn.amount > 0 && <li>About {formatINR(fn.amount)}</li>}
      </ul>
      <FunctionGuests name={fn.name} planned={fn.guests} {...guests} />
      {fn.mood && <p className="fn-mood">{fn.mood}</p>}
      <LabelledList label="Usually done" items={fn.rituals} />
      <LabelledList label="You'll need" items={fn.needs} />
    </article>
  );
}

/** All functions grouped by day, each as a card. */
export function FunctionsSection({ plan, firstDay, ...guests }: FunctionsProps) {
  const days = [...new Set(plan.functions.map((f) => f.day))].sort((a, b) => a - b);
  return (
    <>
      <h2 className="section-title">Functions</h2>
      <p className="note small">
        Every family does things a little differently. These are what is usually done, so check the details with family
        elders and your priest, qazi, granthi or pastor.
      </p>
      {days.map((day) => {
        const date = dateOfDay(firstDay, day);
        return (
          <section key={day} className="fn-day-block" aria-labelledby={`fn-day-${day}`}>
            <h3 id={`fn-day-${day}`} className="small-heading">
              {dayLabel(day)}
              {date && <span className="muted"> · {shortDate(date)}</span>}
            </h3>
            <div className="fn-cards">
              {plan.functions
                .filter((f) => f.day === day)
                .map((f) => (
                  <FunctionCard key={f.name} fn={f} guests={guests} />
                ))}
            </div>
          </section>
        );
      })}
      <p className="muted small">Costs are planning estimates that add up to your total budget, not quotes.</p>
    </>
  );
}
