"use client";

import { useState } from "react";
import { formatINR, rebalance } from "@/lib/budget";
import type { DayTimings } from "@/lib/muhurat";
import type { Plan } from "@/lib/schemas";
import { dueText, shortDate, type ScheduledItem } from "@/lib/schedule";
import type { Assignments, Done, Member, PlanItem } from "@/lib/team";
import type { PaymentSummary } from "@/lib/deals";
import { VendorDeal, type DealState } from "./VendorDeal";

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
        {showOwnerName && <span className="small muted">{owner ? owner.name : "Unassigned"}</span>}
      </span>
      {!showOwnerName && <OwnerPicker item={item} state={state} />}
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

export function VendorsSection({
  items,
  plan,
  state,
  deals,
}: {
  items: ScheduledItem[];
  plan: Plan;
  state: TaskState;
  /** Quotes and bookings. Left out where the plan is read-only. */
  deals?: DealState;
}) {
  const booked = items.filter((i) => state.done[i.id]).length;
  const rows = plan.vendors.map((v, i) => ({ v, item: items[i] })).filter(({ item }) => visible(item, state));
  return (
    <>
      <h2 className="section-title">Vendor checklist</h2>
      <p className="muted">
        {booked} of {items.length} booked
      </p>
      {rows.length === 0 && <p className="muted">No vendors for this person yet.</p>}
      <ul className="vendors">
        {rows.map(({ v, item }) => (
          <li key={item.id} className="vendor card-inner">
            <ul className="checklist vendor-head">
              <TaskRow item={item} state={state} />
            </ul>
            <span className={`badge ${v.priority === "must-have" ? "badge-must" : ""}`}>{v.priority}</span>
            {v.questions.length > 0 && (
              <>
                <h3 className="small-heading">Questions to ask</h3>
                <ul className="list">
                  {v.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </>
            )}
            {deals && <VendorDeal vendor={{ id: item.id, type: v.type }} brief={v.brief} state={deals} />}
            <details>
              <summary>Ready-to-send message for the {v.type.toLowerCase()}</summary>
              <p className="brief">{v.brief}</p>
              <div className="row no-print">
                <CopyButton text={v.brief} label="message" />
                <a
                  className="btn btn-small"
                  href={`https://wa.me/?text=${encodeURIComponent(v.brief)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Send on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}

export function IdeasSection({ plan }: { plan: Plan }) {
  const groups: [string, string[]][] = [
    ["Decor", plan.ideas.decor],
    ["Food & drinks", plan.ideas.food],
    ["Activities", plan.ideas.activities],
    ["Special touches", plan.ideas.extras],
  ];
  return (
    <>
      <h2 className="section-title">Ideas</h2>
      <div className="theme card-inner">
        <h3>Theme: {plan.theme.name}</h3>
        <p>{plan.theme.description}</p>
        {plan.theme.colors.length > 0 && <p className="muted">Colours: {plan.theme.colors.join(", ")}</p>}
      </div>
      <div className="ideas-grid">
        {groups
          .filter(([, list]) => list.length > 0)
          .map(([title, list]) => (
            <div key={title} className="card-inner">
              <h3>{title}</h3>
              <ul className="list">
                {list.map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </>
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
