"use client";

import { useId, useRef, useState } from "react";
import { formatINR, formatShortINR } from "@/lib/budget";
import { budgetForVendor } from "@/lib/deals";
import type { ScheduledItem } from "@/lib/schedule";
import type { Plan } from "@/lib/schemas";
import {
  currentStep,
  rowDetail,
  rowStatus,
  shortName,
  vendorGroups,
  vendorIcon,
  vendorSummary,
  type VendorRow,
  type VendorStep,
  type VendorSummary,
} from "@/lib/vendorSummary";
import { CopyButton, TaskRow, type TaskState } from "./PlanSections";
import { VendorDeal, type DealState } from "./VendorDeal";

/**
 * Vendors: a short summary, then two groups ("To book", "Booked") of one-line
 * rows. Tapping a vendor opens it with three steps: Ask vendors → Compare
 * quotes → Book. On phones the vendor opens in place of the list; on wider
 * screens the list stays on the left and the vendor shows on the right.
 */

const STEPS: { id: VendorStep; label: string }[] = [
  { id: "ask", label: "Ask" },
  { id: "compare", label: "Compare" },
  { id: "book", label: "Book" },
];
const STEP_ORDER: VendorStep[] = ["ask", "compare", "book"];

const pct = (n: number, of: number) => (of ? `${(n / of) * 100}%` : "0%");

function Summary({ s, onOpen }: { s: VendorSummary; onOpen: (id: string) => void }) {
  return (
    <section className="vb-summary card-inner" aria-label="Vendor summary">
      <div className="vb-count">
        <p className="vb-big">
          {s.booked.length} of {s.needed} booked
        </p>
        <div
          className="vs-bar"
          role="img"
          aria-label={`${s.booked.length} booked, ${s.gettingQuotes.length} getting quotes, ${s.notStarted.length} not started, out of ${s.needed}`}
        >
          <span className="vs-bar-booked" style={{ width: pct(s.booked.length, s.needed) }} />
          <span className="vs-bar-quotes" style={{ width: pct(s.gettingQuotes.length, s.needed) }} />
        </div>
      </div>
      <dl className="vb-money">
        <div>
          <dt>Vendor budget</dt>
          <dd>{formatShortINR(s.vendorBudget)}</dd>
        </div>
        <div>
          <dt>Booked</dt>
          <dd className={s.payments.committed > s.vendorBudget ? "over-budget" : undefined}>
            {formatShortINR(s.payments.committed)}
          </dd>
        </div>
        <div>
          <dt>Balance due</dt>
          <dd>{formatShortINR(s.payments.balanceDue)}</dd>
        </div>
      </dl>
      {s.next ? (
        <p className={`vb-next${s.next.overdue ? " is-late" : ""}`}>
          <span>
            {s.next.overdue ? "Overdue" : "Book next"} · <strong>{shortName(s.next.type)}</strong>
          </span>
          <button
            type="button"
            className="btn btn-small btn-primary no-print"
            onClick={() => onOpen(s.next!.id)}
            aria-label={`Open ${shortName(s.next.type)}`}
          >
            Open
          </button>
        </p>
      ) : (
        s.needed > 0 && (
          <p className="vb-next is-done">
            <strong>All vendors booked.</strong> Keep track of advances and balances here.
          </p>
        )
      )}
    </section>
  );
}

function Row({
  row,
  selected,
  onOpen,
  rowRef,
}: {
  row: VendorRow;
  selected: boolean;
  onOpen: () => void;
  rowRef: (el: HTMLButtonElement | null) => void;
}) {
  const status = rowStatus(row);
  return (
    <li>
      <button
        type="button"
        ref={rowRef}
        className={`vb-row${selected ? " is-selected" : ""}`}
        aria-current={selected ? "true" : undefined}
        onClick={onOpen}
      >
        <span className="vb-icon" aria-hidden="true">
          {vendorIcon(row.type)}
        </span>
        <span className="vb-name">
          <span className="vb-title">
            {shortName(row.type)}
            {row.mustHave && <span className="vb-must">Must</span>}
          </span>
          <span className="vb-sub">{rowDetail(row)}</span>
        </span>
        <span className={`vb-status is-${status.tone}`}>
          {status.tone === "ok" && <span aria-hidden="true">✓ </span>}
          {status.text}
        </span>
        <span className="vb-chev" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  );
}

function Group({
  title,
  rows,
  selected,
  onOpen,
  rowRefs,
}: {
  title: string;
  rows: VendorRow[];
  selected: string;
  onOpen: (id: string) => void;
  rowRefs: React.RefObject<Map<string, HTMLButtonElement>>;
}) {
  const id = useId();
  if (rows.length === 0) return null;
  return (
    <section className="vb-group" aria-labelledby={id}>
      <h3 className="vb-group-head" id={id}>
        {title} <span className="vb-group-n">{rows.length}</span>
      </h3>
      <ul className="vb-list">
        {rows.map((r) => (
          <Row
            key={r.id}
            row={r}
            selected={r.id === selected}
            onOpen={() => onOpen(r.id)}
            rowRef={(el) => {
              if (el) rowRefs.current.set(r.id, el);
              else rowRefs.current.delete(r.id);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function AskStep({ type, brief, questions }: { type: string; brief: string; questions: string[] }) {
  return (
    <div className="vb-ask">
      <h3 className="small-heading">Message to send {shortName(type).toLowerCase()}s</h3>
      <p className="brief">{brief}</p>
      <div className="row no-print">
        <CopyButton text={brief} label="message" />
        <a
          className="btn btn-small"
          href={`https://wa.me/?text=${encodeURIComponent(brief)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Send on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      {questions.length > 0 && (
        <>
          <h3 className="small-heading">Questions to ask</h3>
          <ul className="list">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Detail({
  row,
  item,
  vendor,
  state,
  deals,
  step,
  onStep,
  onBack,
  headingRef,
}: {
  row: VendorRow;
  item: ScheduledItem;
  vendor: Plan["vendors"][number];
  state: TaskState;
  deals?: DealState;
  step: VendorStep;
  onStep: (step: VendorStep) => void;
  onBack: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const ref = { id: item.id, type: vendor.type };
  const money = deals ? budgetForVendor(ref, deals.vendors, deals.deals, deals.budget) : null;
  const reached = STEP_ORDER.indexOf(currentStep(row));
  const shown = deals ? step : "ask";
  return (
    <section className="vb-detail card-inner" aria-labelledby={`vb-${item.id}`}>
      <button type="button" className="btn btn-link btn-small vb-back no-print" onClick={onBack}>
        ‹ All vendors
      </button>
      <div className="vb-detail-head">
        <span className="vb-icon" aria-hidden="true">
          {vendorIcon(vendor.type)}
        </span>
        <h3 id={`vb-${item.id}`} ref={headingRef} tabIndex={-1}>
          {vendor.type}
        </h3>
        {row.mustHave && <span className="vb-must">Must</span>}
      </div>
      {money && <p className="vb-meta small">Budget {formatINR(money.available)}</p>}
      <ul className="checklist vb-task">
        <TaskRow item={item} state={state} />
      </ul>

      {deals && (
        <div className="vb-steps no-print" role="group" aria-label="Steps">
          {STEPS.map((s, i) => {
            const done = i < reached;
            return (
              <button
                key={s.id}
                type="button"
                className={`vb-step${done ? " is-done" : ""}`}
                aria-pressed={step === s.id}
                onClick={() => onStep(s.id)}
              >
                {done && <span aria-hidden="true">✓ </span>}
                {i + 1} {s.label}
                {done && <span className="sr-only"> (done)</span>}
              </button>
            );
          })}
        </div>
      )}

      {shown === "ask" && <AskStep type={vendor.type} brief={vendor.brief} questions={vendor.questions} />}
      {deals && shown !== "ask" && (
        <VendorDeal vendor={ref} brief={vendor.brief} state={deals} part={shown} onStep={(p) => onStep(p)} />
      )}
      {deals && shown !== "ask" && (
        <div className="vb-folds">
          <details>
            <summary>Message to send vendors</summary>
            <p className="brief">{vendor.brief}</p>
            <div className="row no-print">
              <CopyButton text={vendor.brief} label="message" />
              <a
                className="btn btn-small"
                href={`https://wa.me/?text=${encodeURIComponent(vendor.brief)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Send on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </details>
          {vendor.questions.length > 0 && (
            <details>
              <summary>Questions to ask ({vendor.questions.length})</summary>
              <ul className="list">
                {vendor.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
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
  const summary = vendorSummary(items, plan, deals?.deals ?? {}, state.done);
  const shownIds = new Set(
    items.filter((item) => !state.viewer || state.assignments[item.id] === state.viewer).map((i) => i.id),
  );
  const rows = summary.rows.filter((r) => shownIds.has(r.id));
  const groups = vendorGroups(rows);

  // `open` is the vendor the host tapped (phones show it instead of the list).
  // Wider screens always show one vendor beside the list: the tapped one, else the most urgent.
  const [open, setOpen] = useState("");
  const [steps, setSteps] = useState<Record<string, VendorStep>>({});
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const fallback = groups.toBook[0]?.id ?? groups.booked[0]?.id ?? "";
  const selected = rows.some((r) => r.id === open) ? open : fallback;
  const index = items.findIndex((i) => i.id === selected);
  const selectedRow = rows.find((r) => r.id === selected);

  function openVendor(id: string) {
    setOpen(id);
    requestAnimationFrame(() => {
      const heading = headingRef.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      const box = heading.closest("section");
      const top = box?.getBoundingClientRect().top ?? 0;
      if (top < 0 || top > window.innerHeight * 0.5) box?.scrollIntoView?.({ block: "start" });
    });
  }
  function back() {
    const id = open;
    setOpen("");
    requestAnimationFrame(() => rowRefs.current.get(id)?.focus());
  }

  return (
    <>
      <h2 className="section-title">Vendors</h2>
      {rows.length === 0 ? (
        <p className="muted">No vendors for this person yet.</p>
      ) : (
        <div className={`vb${open && selectedRow ? " is-open" : ""}`}>
          <Summary s={summary} onOpen={openVendor} />
          <div className="vb-cols">
            <div className="vb-lists">
              <Group title="To book" rows={groups.toBook} selected={selected} onOpen={openVendor} rowRefs={rowRefs} />
              <Group title="Booked" rows={groups.booked} selected={selected} onOpen={openVendor} rowRefs={rowRefs} />
            </div>
            {selectedRow && index >= 0 && (
              <Detail
                key={selected}
                row={selectedRow}
                item={items[index]}
                vendor={plan.vendors[index]}
                state={state}
                deals={deals}
                step={steps[selected] ?? currentStep(selectedRow)}
                onStep={(s) => setSteps((prev) => ({ ...prev, [selected]: s }))}
                onBack={back}
                headingRef={headingRef}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
