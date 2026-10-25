"use client";

import { useState } from "react";
import { formatINR } from "@/lib/budget";
import type { DayTimings } from "@/lib/muhurat";
import type { Plan } from "@/lib/schemas";
import { dueText, shortDate, type ScheduledItem } from "@/lib/schedule";
import type { Assignments, Done, Member, PlanItem } from "@/lib/team";

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

export function BudgetSection({ plan, total }: { plan: Plan; total: number }) {
  const max = Math.max(...plan.budget.map((b) => b.amount), 1);
  return (
    <>
      <h2 className="section-title">Budget split</h2>
      <div className="table-wrap">
        <table className="budget-table">
          <caption className="sr-only">Budget by category, total {formatINR(total)}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className="num">
                Amount
              </th>
              <th scope="col" className="num">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.budget.map((line) => {
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
                  <td className="num">{formatINR(line.amount)}</td>
                  <td className="num">{share}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num">{formatINR(total)}</td>
              <td className="num">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
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

export function VendorsSection({ items, plan, state }: { items: ScheduledItem[]; plan: Plan; state: TaskState }) {
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
