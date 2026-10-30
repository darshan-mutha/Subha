"use client";

import { formatINR } from "@/lib/budget";
import { budgetForVendor } from "@/lib/deals";
import type { ScheduledItem } from "@/lib/schedule";
import type { Plan } from "@/lib/schemas";
import { currentStep, shortName, vendorIcon, type VendorRow, type VendorStep } from "@/lib/vendorSummary";
import { whatsappLink } from "@/lib/team";
import { CopyButton } from "../plan/CopyButton";
import { TaskRow } from "../plan/TaskRow";
import type { TaskState } from "../plan/types";
import { VendorDeal, type DealState } from "../VendorDeal";
import { TabPanel, ViewTabs, type ViewTab } from "../ViewTabs";

const STEPS: { id: VendorStep; label: string }[] = [
  { id: "ask", label: "Ask" },
  { id: "compare", label: "Compare" },
  { id: "book", label: "Book" },
];
const STEP_ORDER: VendorStep[] = ["ask", "compare", "book"];

/** The message to send vendors (with Copy and WhatsApp) and the questions to ask them. */
function VendorBrief({ brief, questions, folded }: { brief: string; questions: string[]; folded: boolean }) {
  const actions = (
    <div className="row no-print">
      <CopyButton text={brief} label="message" />
      <a className="btn btn-small" href={whatsappLink(brief)} target="_blank" rel="noopener noreferrer">
        Send on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
  const list = (
    <ul className="list">
      {questions.map((q) => (
        <li key={q}>{q}</li>
      ))}
    </ul>
  );
  if (folded) {
    return (
      <>
        <details>
          <summary>Message to send vendors</summary>
          <p className="brief">{brief}</p>
          {actions}
        </details>
        {questions.length > 0 && (
          <details>
            <summary>Questions to ask ({questions.length})</summary>
            {list}
          </details>
        )}
      </>
    );
  }
  return (
    <>
      <p className="brief">{brief}</p>
      {actions}
      {questions.length > 0 && (
        <>
          <h3 className="small-heading">Questions to ask</h3>
          {list}
        </>
      )}
    </>
  );
}

function AskStep({ type, brief, questions }: { type: string; brief: string; questions: string[] }) {
  return (
    <div className="vb-ask">
      <h3 className="small-heading">Message to send {shortName(type).toLowerCase()}s</h3>
      <VendorBrief brief={brief} questions={questions} folded={false} />
    </div>
  );
}

/** Ask → Compare → Book tabs; steps before the vendor's current one show a tick. */
function StepTabs({
  base,
  reached,
  step,
  onStep,
}: {
  base: string;
  reached: number;
  step: VendorStep;
  onStep: (step: VendorStep) => void;
}) {
  const items: ViewTab<VendorStep>[] = STEPS.map((s, i) => {
    const done = i < reached;
    return {
      id: s.id,
      className: done ? "is-done" : undefined,
      label: (
        <>
          {done && <span aria-hidden="true">✓ </span>}
          {i + 1} {s.label}
          {done && <span className="sr-only"> (done)</span>}
        </>
      ),
    };
  });
  return (
    <ViewTabs
      base={base}
      label="Steps"
      className="vb-steps no-print"
      tabClassName="vb-step"
      items={items}
      current={step}
      onSelect={onStep}
    />
  );
}

/** One vendor, opened: its task, the Ask → Compare → Book steps, and the step's content. */
export function Detail({
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
  const base = `vb-${item.id}-step`;
  return (
    <section className="vb-detail card-inner" aria-labelledby={`vb-${item.id}`}>
      <DetailHead
        id={`vb-${item.id}`}
        type={vendor.type}
        mustHave={row.mustHave}
        onBack={onBack}
        headingRef={headingRef}
      />
      {money && <p className="vb-meta small">Budget {formatINR(money.available)}</p>}
      <ul className="checklist vb-task">
        <TaskRow item={item} state={state} />
      </ul>

      {deals ? (
        <>
          <StepTabs base={base} reached={reached} step={step} onStep={onStep} />
          <TabPanel base={base} id={shown}>
            {shown === "ask" ? (
              <AskStep type={vendor.type} brief={vendor.brief} questions={vendor.questions} />
            ) : (
              <>
                <VendorDeal vendor={ref} brief={vendor.brief} state={deals} part={shown} onStep={onStep} />
                <div className="vb-folds">
                  <VendorBrief brief={vendor.brief} questions={vendor.questions} folded />
                </div>
              </>
            )}
          </TabPanel>
        </>
      ) : (
        <AskStep type={vendor.type} brief={vendor.brief} questions={vendor.questions} />
      )}
    </section>
  );
}

/** "‹ All vendors" plus the vendor's icon, focusable heading and must-have tag. */
function DetailHead({
  id,
  type,
  mustHave,
  onBack,
  headingRef,
}: {
  id: string;
  type: string;
  mustHave: boolean;
  onBack: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <>
      <button type="button" className="btn btn-link btn-small vb-back no-print" onClick={onBack}>
        ‹ All vendors
      </button>
      <div className="vb-detail-head">
        <span className="vb-icon" aria-hidden="true">
          {vendorIcon(type)}
        </span>
        <h3 id={id} ref={headingRef} tabIndex={-1}>
          {type}
        </h3>
        {mustHave && <span className="vb-must">Must</span>}
      </div>
    </>
  );
}
