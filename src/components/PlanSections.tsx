"use client";

import { useEffect, useRef, useState } from "react";
import { formatINR, rebalance } from "@/lib/budget";
import type { DayTimings } from "@/lib/muhurat";
import type { Plan } from "@/lib/schemas";
import {
  canDelay,
  daysBetween,
  DELAY_CHOICES,
  delayedDate,
  dueText,
  shiftText,
  shortDate,
  type ScheduledItem,
} from "@/lib/schedule";
import type { Assignments, Done, Member, PlanItem } from "@/lib/team";
import type { PaymentSummary } from "@/lib/deals";
import { dateOfDay, dayLabel } from "@/lib/traditions";
import { functionCount, overInvited, type GuestList } from "@/lib/guestList";
import type { Reply } from "@/lib/rsvp";

/** Shared task state: ticks and owners, controlled by the workspace. */
export interface TaskState {
  done: Done;
  onToggle: (itemId: string, done: boolean) => void;
  team: Member[];
  assignments: Assignments;
  onAssign: (itemId: string, memberId: string) => void;
  /** When set, only this person's items are shown. */
  viewer: string;
  /** Today's date (YYYY-MM-DD, India), for due-date labels. */
  today: string;
  /** Event date (YYYY-MM-DD). With onDelay, tasks can be marked as running late. */
  eventDate?: string;
  /** Moves a late task, and the tasks after it, by this many days. */
  onDelay?: (item: ScheduledItem, days: number) => void;
}

const PRIORITY_LABEL: Record<ScheduledItem["priority"], string> = { high: "High", medium: "Medium", low: "Low" };

export function PriorityBadge({ priority }: { priority: ScheduledItem["priority"] }) {
  return (
    <span className={`badge priority-${priority}`}>
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function DueLabel({ item, today }: { item: ScheduledItem; today: string }) {
  return <span className={`due due-${item.status}`}>{dueText(item, today)}</span>;
}

function visible(item: PlanItem, state: TaskState): boolean {
  return !state.viewer || state.assignments[item.id] === state.viewer;
}

function OwnerPicker({ item, state }: { item: PlanItem; state: TaskState }) {
  if (state.team.length === 0) return null;
  return (
    <select
      className="owner"
      aria-label={`Who will do this: ${item.label}`}
      value={state.assignments[item.id] ?? ""}
      onChange={(e) => state.onAssign(item.id, e.target.value)}
    >
      <option value="">Unassigned</option>
      {state.team.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

/** "Running late?" — pick a new date, and later tasks move with it. */
function LateControl({ item, state, id }: { item: ScheduledItem; state: TaskState; id: string }) {
  const [open, setOpen] = useState(false);
  const { eventDate, onDelay, today } = state;
  const options = eventDate
    ? DELAY_CHOICES.map((days) => ({ days, date: delayedDate(item, days, today, eventDate) })).filter(
        (o, i, all) => o.date > item.due && all.findIndex((x) => x.date === o.date) === i,
      )
    : [];
  const [choice, setChoice] = useState(0);
  const selectRef = useRef<HTMLSelectElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Keyboard and screen-reader users land in the panel when it opens, and back on the button when it closes.
  useEffect(() => {
    if (open) selectRef.current?.focus();
    else if (wasOpen.current) toggleRef.current?.focus();
    wasOpen.current = open;
  }, [open]);
  if (!eventDate || !onDelay || !canDelay(item, eventDate) || options.length === 0) return null;
  const selected = options[Math.min(choice, options.length - 1)];
  if (!open) {
    return (
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-link btn-small late-toggle no-print"
        aria-expanded="false"
        aria-controls={`${id}-late`}
        aria-label={`Running late? ${item.label}`}
        onClick={() => setOpen(true)}
      >
        Running late?
      </button>
    );
  }
  return (
    <div
      className="late-panel no-print"
      id={`${id}-late`}
      role="group"
      aria-labelledby={`${id}-late-label`}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <label id={`${id}-late-label`} htmlFor={`${id}-late-date`}>
        When will “{item.label}” be done?
      </label>
      <select ref={selectRef} id={`${id}-late-date`} value={choice} onChange={(e) => setChoice(Number(e.target.value))}>
        {options.map((o, i) => (
          <option key={o.date} value={i}>
            By {shortDate(o.date)} ({daysBetween(item.due, o.date)} days later)
          </option>
        ))}
      </select>
      <p className="small muted">Tasks after this one will move by the same number of days. The event date stays.</p>
      <div className="row">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            setOpen(false);
            onDelay(item, selected.days);
          }}
        >
          Move it and later tasks
        </button>
        <button type="button" className="btn btn-link btn-small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function TaskRow({
  item,
  state,
  idPrefix = "item",
  showOwnerName = false,
}: {
  item: ScheduledItem;
  state: TaskState;
  idPrefix?: string;
  showOwnerName?: boolean;
}) {
  const id = `${idPrefix}-${item.id}`;
  const owner = state.team.find((m) => m.id === state.assignments[item.id]);
  return (
    <li className={`task-row status-${item.status}`}>
      <input
        type="checkbox"
        id={id}
        checked={Boolean(state.done[item.id])}
        onChange={(e) => state.onToggle(item.id, e.target.checked)}
        aria-describedby={`${id}-meta`}
      />
      <label htmlFor={id}>{item.kind === "task" ? item.label : <strong>{item.label}</strong>}</label>
      <span className="task-meta" id={`${id}-meta`}>
        <PriorityBadge priority={item.priority} />
        <DueLabel item={item} today={state.today} />
        {item.shifted > 0 && item.status !== "done" && (
          <span className="small muted shifted">{shiftText(item.shifted)}</span>
        )}
        {showOwnerName && <span className="small muted">{owner ? owner.name : "Unassigned"}</span>}
      </span>
      {!showOwnerName && <OwnerPicker item={item} state={state} />}
      <LateControl item={item} state={state} id={id} />
    </li>
  );
}

/** The few most urgent unfinished tasks, across the timeline and vendor bookings. */
export function DoNextSection({ items, state }: { items: ScheduledItem[]; state: TaskState }) {
  const owner = state.team.find((m) => m.id === state.viewer);
  return (
    <section className="card do-next" aria-labelledby="do-next-heading">
      <h2 id="do-next-heading" className="section-title">
        Do next{owner ? ` · ${owner.name}` : ""}
      </h2>
      {items.length === 0 ? (
        <p className="muted">You&apos;re all caught up. Nothing is due right now.</p>
      ) : (
        <ul className="checklist">
          {items.map((item) => (
            <TaskRow key={item.id} item={item} state={state} idPrefix="next" showOwnerName={state.team.length > 0} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AmountInput({
  line,
  index,
  onCommit,
}: {
  line: Plan["budget"][number];
  index: number;
  onCommit: (index: number, amount: number) => void;
}) {
  const grouped = (n: number) => n.toLocaleString("en-IN");
  const [draft, setDraft] = useState(grouped(line.amount));
  const [seen, setSeen] = useState(line.amount);
  if (seen !== line.amount) {
    // The amount changed elsewhere (rebalance, AI update, teammate): show the new value.
    setSeen(line.amount);
    setDraft(grouped(line.amount));
  }
  const id = `amount-${index}`;
  const commit = () => {
    const digits = draft.replace(/[^\d]/g, "");
    const value = Number(digits);
    if (digits === "" || value === line.amount) {
      setDraft(grouped(line.amount));
      return;
    }
    onCommit(index, value);
  };
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Amount for {line.category} in rupees
      </label>
      <span className="amount-input no-print">
        <span aria-hidden="true">₹</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      </span>
      <span className="print-only">{formatINR(line.amount)}</span>
    </>
  );
}

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
  const max = Math.max(...plan.budget.map((b) => b.amount), 1);
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
      {showBooked && payments && (
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
      )}
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
                    {onBudgetChange ? (
                      <AmountInput line={line} index={index} onCommit={commit} />
                    ) : (
                      formatINR(line.amount)
                    )}
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

export function TimelineSection({
  tasks,
  stepDue,
  plan,
  state,
}: {
  tasks: ScheduledItem[][];
  stepDue: string[];
  plan: Plan;
  state: TaskState;
}) {
  const steps = plan.timeline
    .map((step, i) => ({ step, due: stepDue[i], items: tasks[i].filter((t) => visible(t, state)) }))
    .filter(({ items }) => items.length > 0);
  return (
    <>
      <h2 className="section-title">Timeline</h2>
      {steps.length === 0 && <p className="muted">No tasks for this person yet.</p>}
      <ol className="timeline">
        {steps.map(({ step, due, items }, i) => (
          <li key={`${step.when}-${i}`}>
            <h3>
              {step.when} <span className="step-date">· {shortDate(due)}</span>
            </h3>
            <ul className="checklist">
              {items.map((item) => (
                <TaskRow key={item.id} item={item} state={state} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn btn-small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus("Copied");
          } catch {
            setStatus("Copy failed – please select the text");
          }
          setTimeout(() => setStatus(""), 2500);
        }}
      >
        Copy {label}
      </button>
      <span role="status" className="small muted">
        {status}
      </span>
    </>
  );
}

/** Functions of a multi-day event, day by day. */
interface FunctionsProps {
  plan: Plan;
  firstDay: string;
  /** The host's guest list and the replies, for counts per function. */
  entries?: GuestList;
  replies?: Reply[];
  busy?: boolean;
  /** Re-plans one function for a new guest count (What changed + Undo). */
  onPlanFor?: (fn: string, guests: number) => void;
  /** Opens Guests → Seating for one function. */
  onSeat?: (fn: string) => void;
}

/** "From your guest list" on a function card: invited, coming, no reply. */
function FunctionGuests({
  name,
  planned,
  entries,
  replies,
  busy,
  onPlanFor,
  onSeat,
}: { name: string; planned: number } & Omit<FunctionsProps, "plan" | "firstDay">) {
  const count = functionCount(entries ?? [], replies ?? [], name);
  if (count.families === 0) return null;
  const pct = (n: number) => `${Math.min(100, Math.round((n / Math.max(1, count.invited)) * 100))}%`;
  const over = overInvited(count.invited, planned);
  const n = (x: number) => x.toLocaleString("en-IN");
  return (
    <div className="fn-guests">
      <p className="fn-label">From your guest list</p>
      <div
        className="fn-bar"
        role="img"
        aria-label={`${n(count.coming)} coming and ${n(count.waiting)} with no reply, of ${n(count.invited)} invited`}
      >
        <span className="is-coming" style={{ width: pct(count.coming) }} />
        <span className="is-waiting" style={{ width: pct(count.waiting) }} />
      </div>
      <p className="small">
        {n(count.invited)} invited · <strong>{n(count.coming)} coming</strong>
        {count.maybe > 0 && ` · ${n(count.maybe)} maybe`} · {n(count.waiting)} no reply
      </p>
      {over && (
        <p className="fn-warn small">
          {n(count.invited - planned)} more invited than planned ({n(planned)}).
        </p>
      )}
      <div className="row no-print">
        {over && onPlanFor && (
          <button
            type="button"
            className="btn btn-small"
            disabled={busy}
            onClick={() => onPlanFor(name, count.invited)}
          >
            Plan for {n(count.invited)}
          </button>
        )}
        {onSeat && (
          <button type="button" className="btn btn-small btn-link" onClick={() => onSeat(name)}>
            Seat this function
          </button>
        )}
      </div>
    </div>
  );
}

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
                  <article key={f.name} className="card-inner fn-card">
                    <h4>{f.name}</h4>
                    <ul className="facts small" aria-label={`${f.name} details`}>
                      {f.time && <li>{f.time}</li>}
                      {f.guests > 0 && <li>{f.guests.toLocaleString("en-IN")} guests</li>}
                      {f.amount > 0 && <li>About {formatINR(f.amount)}</li>}
                    </ul>
                    <FunctionGuests name={f.name} planned={f.guests} {...guests} />
                    {f.mood && <p className="fn-mood">{f.mood}</p>}
                    {f.rituals.length > 0 && (
                      <>
                        <p className="fn-label">Usually done</p>
                        <ul className="list small">
                          {f.rituals.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {f.needs.length > 0 && (
                      <>
                        <p className="fn-label">You&apos;ll need</p>
                        <ul className="list small">
                          {f.needs.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </article>
                ))}
            </div>
          </section>
        );
      })}
      <p className="muted small">Costs are planning estimates that add up to your total budget, not quotes.</p>
    </>
  );
}

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

export function TimingsSection({ timings }: { timings: DayTimings }) {
  const rows: [string, { start: string; end: string }][] = [
    ["Rahu Kalam", timings.rahuKalam],
    ["Yamagandam", timings.yamagandam],
    ["Gulika Kalam", timings.gulikaKalam],
  ];
  return (
    <>
      <h2 className="section-title">Auspicious timings</h2>
      <p>
        {timings.weekday}, {timings.date} in {timings.location}. Sunrise {timings.sunrise}, sunset {timings.sunset}.
      </p>
      <div className="table-wrap">
        <table className="budget-table">
          <caption className="sr-only">Periods traditionally avoided for starting ceremonies</caption>
          <thead>
            <tr>
              <th scope="col">Period to avoid</th>
              <th scope="col">From</th>
              <th scope="col">To</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, range]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{range.start}</td>
                <td>{range.end}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Better windows during the day</h3>
      <ul className="list">
        {timings.betterWindows.map((w) => (
          <li key={w.start}>
            {w.start} – {w.end}
          </li>
        ))}
      </ul>
      <p className="note">
        Calculated from local sunrise and sunset. Please confirm the exact muhurat with your family priest or a
        panchang.
      </p>
    </>
  );
}
