"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { formatINR } from "@/lib/budget";
import { ApiError, loadBlooms, requestAssign, requestRefine, saveBlooms, type LocalWorkspace } from "@/lib/client";
import { progressOf } from "@/lib/palette";
import { EVENT_TYPE_LABELS, FOCUS_LABELS, FOOD_LABELS, GUEST_NEED_LABELS, LIMITS, todayIST } from "@/lib/schemas";
import {
  bloomMessage,
  delayItem,
  delayLines,
  doNext,
  milestoneItems,
  petalsFilled,
  pruneShifts,
  schedule,
  type ScheduledItem,
} from "@/lib/schedule";
import { bookedByLine, paymentSummary, pruneDeals, type Deal } from "@/lib/deals";
import { planItems, type Member, type SharedPlanContent } from "@/lib/team";
import type { DealState } from "./VendorDeal";
import {
  BudgetSection,
  DoNextSection,
  IdeasSection,
  TimelineSection,
  TimingsSection,
  VendorsSection,
  type TaskState,
} from "./PlanSections";
import { Tabs, type TabItem } from "./Tabs";
import { TeamPanel } from "./TeamPanel";
import { InviteMaker } from "./InviteMaker";
import { PetalMark, Toran } from "./Brand";
import { Bloom } from "./Celebrate";
import { CopyButton } from "./PlanSections";
import { SavingsChoices } from "./SavingsChoices";
import { applyRaise, overLines, totalOver, type SavingOption, type SavingsRequest } from "@/lib/savings";

const REFINE_SUGGESTIONS = [
  "We added 50 guests, the budget is 10% lower and the date moved 2 weeks earlier",
  "Reduce the budget by 20%",
  "Move the event 1 week later",
  "Make it eco-friendly",
];

/** The plan as it was before the last change, so the host can undo it. */
type Snapshot = Partial<SharedPlanContent>;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function eventTitle(data: Pick<SharedPlanContent, "input">): string {
  return data.input.eventName || `our ${EVENT_TYPE_LABELS[data.input.eventType].toLowerCase()}`;
}

/** Ease-out curve, so colour starts showing after the first few ticks. */
export function aliveFromProgress(p: number): number {
  return 1 - (1 - p) ** 2;
}

interface Props {
  data: LocalWorkspace;
  /** Identifies the plan on this device, for remembering which milestone moments have played. */
  planKey: string;
  shareUrl: string | null;
  /** Saves changes to plan content (team, owners, refined plan). */
  onChange: (content: Partial<SharedPlanContent>) => Promise<void>;
  onToggle: (itemId: string, done: boolean) => void;
  onShare: (() => Promise<void>) | null;
  onEdit: (() => void) | null;
  onStartOver: () => void;
  /** Opens the list of events on this device. */
  onMyEvents?: () => void;
  /** How many events are on this device, shown on the My events button. */
  eventCount?: number;
  viewer: string;
  onViewerChange: (memberId: string) => void;
  /** Message from the parent, e.g. "Saved" or a sync problem. */
  notice?: string;
}

/** The plan screen: summary, tabs, team panel and the change-request box. */
export function PlanWorkspace({
  data,
  planKey,
  shareUrl,
  onChange,
  onToggle,
  onShare,
  onEdit,
  onStartOver,
  onMyEvents,
  eventCount = 0,
  viewer,
  onViewerChange,
  notice = "",
}: Props) {
  const { input, plan, timings, team, assignments, done } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [announce, setAnnounce] = useState("");
  const [lastChange, setLastChange] = useState<{ lines: string[]; before: Snapshot; note: string } | null>(null);
  const changeRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const today = todayIST();
  const shifts = useMemo(
    () =>
      pruneShifts(
        data.shifts,
        planItems(plan).map((i) => i.id),
      ),
    [data.shifts, plan],
  );
  const scheduled = useMemo(
    () => schedule(plan, input.date, today, done, shifts),
    [plan, input.date, today, done, shifts],
  );
  const items = useMemo(() => [...scheduled.timeline.flat(), ...scheduled.vendors], [scheduled]);
  const upNext = useMemo(() => doNext(items, assignments, viewer), [items, assignments, viewer]);
  const vendorRefs = useMemo(
    () => scheduled.vendors.map((item, i) => ({ id: item.id, type: plan.vendors[i]?.type ?? item.label })),
    [scheduled.vendors, plan.vendors],
  );
  const deals = useMemo(
    () =>
      pruneDeals(
        data.deals,
        vendorRefs.map((v) => v.id),
      ),
    [data.deals, vendorRefs],
  );
  const payments = useMemo(() => paymentSummary(vendorRefs, deals), [vendorRefs, deals]);
  const bookedLines = useMemo(() => bookedByLine(vendorRefs, deals, plan.budget), [vendorRefs, deals, plan.budget]);
  const overList = useMemo(() => overLines(plan.budget, bookedLines), [plan.budget, bookedLines]);
  const overBy = totalOver(overList);
  const [tab, setTab] = useState("budget");

  // "Comes alive": colour grows with the share of tasks done.
  const doneCount = items.filter((i) => i.status === "done").length;
  const progress = progressOf(items.length, doneCount);
  const complete = items.length > 0 && progress === 1;
  const milestones = useMemo(() => milestoneItems(items), [items]);
  const petals = petalsFilled(milestones, progress);
  const milestonesDone = milestones.filter((m) => m.status === "done").length;

  // Milestone moments play once per device. On first view, milestones already done count as played.
  const [played, setPlayed] = useState<string[]>(() => {
    const saved = loadBlooms(planKey);
    if (saved) return saved;
    const seeded = milestones.filter((m) => m.status === "done").map((m) => m.id);
    saveBlooms(planKey, seeded);
    return seeded;
  });
  const bloomIndex = milestones.findIndex((m) => m.status === "done" && !played.includes(m.id));
  const bloomItem = bloomIndex >= 0 ? milestones[bloomIndex] : null;
  const finishBloom = useCallback(() => {
    if (!bloomItem) return;
    setPlayed((list) => {
      const next = [...list, bloomItem.id];
      saveBlooms(planKey, next);
      return next;
    });
  }, [bloomItem, planKey]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--alive", aliveFromProgress(progress).toFixed(3));
    return () => {
      root.style.removeProperty("--alive");
    };
  }, [progress]);

  async function act(task: () => Promise<void>, working: string, doneMessage: string): Promise<boolean> {
    setBusy(true);
    setError("");
    setAnnounce(working);
    try {
      await task();
      setAnnounce(doneMessage);
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
      setError(message);
      setAnnounce(""); // the visible alert announces the error
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Sends a change request in plain words and shows What changed with an Undo. */
  async function applyChange(text: string): Promise<boolean> {
    const before: Snapshot = { input, plan, timings, shifts };
    let lines: string[] = [];
    const ok = await act(
      async () => {
        const next = await requestRefine(input, plan, text);
        lines = next.changes?.length ? next.changes : ["Your plan has been updated."];
        // Keep quotes and bookings for vendors that are still in the refined plan.
        // A re-planned timeline starts fresh, so earlier delays are cleared.
        await onChange({ input: next.input, plan: next.plan, timings: next.timings, deals, shifts: {} });
      },
      "Updating your plan…",
      "Plan updated. See what changed above the tabs.",
    );
    if (ok) {
      setLastChange({ lines, before, note: "Due dates, budget and vendor messages have been updated to match." });
      requestAnimationFrame(() => changeRef.current?.focus());
    }
    return ok;
  }

  async function refine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = instruction.trim();
    if (text.length < 3) {
      setError("Please describe what you want to change.");
      return;
    }
    if (await applyChange(text)) setInstruction("");
  }

  /** The host picked one of the over-budget choices. Raising the budget is done in code; the rest re-plan. */
  async function chooseSaving(option: SavingOption, request: SavingsRequest): Promise<boolean> {
    if (option.kind !== "raise-budget") return applyChange(option.instruction);
    const before: Snapshot = { input, plan };
    const raised = applyRaise(input, plan.budget, request.overLines);
    const ok = await act(
      () => onChange({ input: raised.input, plan: { ...plan, budget: raised.budget } }),
      "Updating the budget…",
      "Budget increased. See what changed above the tabs.",
    );
    if (ok) {
      setLastChange({ lines: raised.changes, before, note: "Your bookings now fit the budget." });
      requestAnimationFrame(() => changeRef.current?.focus());
    }
    return ok;
  }

  /** Opens the Budget tab at the over-budget choices. */
  function showChoices() {
    setTab("budget");
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("[data-savings-heading]");
      heading?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      heading?.focus({ preventScroll: true });
    });
  }

  async function undo() {
    if (!lastChange) return;
    const { before } = lastChange;
    const ok = await act(() => onChange(before), "Undoing…", "Last change undone");
    if (ok) setLastChange(null);
  }

  /** A task is running late: move it and the tasks after it, then show what moved with an Undo. */
  async function delay(item: ScheduledItem, days: number) {
    const result = delayItem(items, shifts, item.id, days, today, input.date);
    if (!result) return;
    const before: Snapshot = { shifts };
    const moved = result.later.length;
    const ok = await act(
      () => onChange({ shifts: result.shifts }),
      "Moving tasks…",
      `Moved ${moved + 1} ${moved === 0 ? "task" : "tasks"}. See what changed above the tabs.`,
    );
    if (ok) {
      setLastChange({
        lines: delayLines(result),
        before,
        note: "Due dates and the Do next list have been updated. Tasks already done did not move.",
      });
      requestAnimationFrame(() => changeRef.current?.focus());
    }
  }

  const autoAssign = () =>
    act(
      async () => {
        const { assignments: next } = await requestAssign(input, plan, team);
        await onChange({ assignments: next });
      },
      "Dividing the tasks…",
      "Tasks divided among your team",
    );

  const changeTeam = (next: Member[]) => {
    const ids = new Set(next.map((m) => m.id));
    const kept = Object.fromEntries(Object.entries(assignments).filter(([, m]) => ids.has(m)));
    if (viewer && !ids.has(viewer)) onViewerChange("");
    return act(() => onChange({ team: next, assignments: kept }), "Saving…", "Team updated");
  };

  const taskState: TaskState = {
    done,
    onToggle,
    team,
    assignments,
    viewer,
    today,
    eventDate: input.date,
    onDelay: (item, days) => void delay(item, days),
    onAssign: (itemId, memberId) => {
      const next = { ...assignments };
      if (memberId) next[itemId] = memberId;
      else delete next[itemId];
      void act(() => onChange({ assignments: next }), "Saving…", "Saved");
    },
  };

  const dealState: DealState = {
    deals,
    input,
    budget: plan.budget,
    vendors: vendorRefs,
    onDeal: (vendorId: string, deal: Deal) => onChange({ deals: { ...deals, [vendorId]: deal } }),
    onBooked: (vendorId: string, isBooked: boolean) => {
      if (Boolean(done[vendorId]) !== isBooked) onToggle(vendorId, isBooked);
    },
  };

  const tabs: TabItem[] = [
    {
      id: "budget",
      label: "Budget",
      content: (
        <>
          <BudgetSection
            plan={plan}
            total={input.budget}
            booked={bookedLines}
            payments={payments}
            onBudgetChange={(lines) =>
              void act(() => onChange({ plan: { ...plan, budget: lines } }), "Saving…", "Budget updated")
            }
          />
          <SavingsChoices input={input} plan={plan} over={overList} busy={busy} onChoose={chooseSaving} />
        </>
      ),
    },
    {
      id: "timeline",
      label: "Timeline",
      content: <TimelineSection tasks={scheduled.timeline} stepDue={scheduled.stepDue} plan={plan} state={taskState} />,
    },
    {
      id: "vendors",
      label: "Vendors",
      content: <VendorsSection items={scheduled.vendors} plan={plan} state={taskState} deals={dealState} />,
    },
    { id: "ideas", label: "Ideas", content: <IdeasSection plan={plan} /> },
    {
      id: "invite",
      label: "Invite",
      content: <InviteMaker input={input} invite={data.invite ?? null} onSave={(invite) => onChange({ invite })} />,
    },
  ];
  if (timings) tabs.push({ id: "timings", label: "Timings", content: <TimingsSection timings={timings} /> });

  return (
    <article className="plan" aria-labelledby="plan-heading" data-complete={complete}>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      <header className="card plan-header">
        {complete && <Toran />}
        <div className="plan-header-top">
          <div>
            <p className="eyebrow">{EVENT_TYPE_LABELS[input.eventType]}</p>
            <h2 id="plan-heading" ref={headingRef} tabIndex={-1}>
              {input.eventName || `Your ${EVENT_TYPE_LABELS[input.eventType].toLowerCase()} plan`}
            </h2>
          </div>
          <PetalMark size={88} filled={petals} className="rangoli" />
        </div>
        <p className="small muted progress-line">
          {Math.round(progress * 100)}% done
          {milestones.length > 0 && ` · ${milestonesDone} of ${milestones.length} milestones`}
        </p>
        <ul className="facts" aria-label="Event details">
          <li>{formatDate(input.date)}</li>
          <li>{input.city}</li>
          <li>{input.guests.toLocaleString("en-IN")} guests</li>
          <li>{formatINR(input.budget)}</li>
        </ul>
        {(input.focus?.length > 0 || input.food || input.guestNeeds?.length > 0) && (
          <ul className="personal-facts" aria-label="What this plan is shaped around">
            {input.focus?.length > 0 && <li>Matters most: {input.focus.map((f) => FOCUS_LABELS[f]).join(", ")}</li>}
            {input.food && <li>Food: {FOOD_LABELS[input.food]}</li>}
            {input.guestNeeds?.map((g) => (
              <li key={g}>{GUEST_NEED_LABELS[g]}</li>
            ))}
          </ul>
        )}
        <p className="summary">{plan.summary}</p>
        <div className="row no-print">
          {onEdit && (
            <button type="button" className="btn" onClick={onEdit}>
              Edit details
            </button>
          )}
          <button type="button" className="btn" onClick={() => window.print()}>
            Download PDF / Print
          </button>
          {onMyEvents && (
            <button type="button" className="btn" onClick={onMyEvents}>
              My events{eventCount > 1 ? ` (${eventCount})` : ""}
            </button>
          )}
          <button type="button" className="btn btn-link" onClick={onStartOver}>
            Plan a new event
          </button>
        </div>
        {notice && (
          <p className="small muted" role="status">
            {notice}
          </p>
        )}
      </header>

      {plan.warnings.length > 0 && (
        <section className="warnings" aria-labelledby="warn-heading">
          <h2 id="warn-heading" className="small-heading">
            Things to watch out for
          </h2>
          <ul>
            {plan.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <TeamPanel
        team={team}
        items={items}
        assignments={assignments}
        done={done}
        eventTitle={eventTitle(data)}
        shareUrl={shareUrl}
        today={today}
        busy={busy}
        onTeamChange={changeTeam}
        onAutoAssign={autoAssign}
        onShare={onShare ? () => void act(onShare, "Creating your team link…", "Team link ready") : null}
      />

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {team.length > 0 && (
        <div className="viewer no-print">
          <label htmlFor="viewer">Show tasks for</label>
          <select id="viewer" value={viewer} onChange={(e) => onViewerChange(e.target.value)}>
            <option value="">Everyone</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {complete ? (
        <section className="card celebrate" aria-labelledby="celebrate-heading">
          <PetalMark size={72} filled={5} />
          <h2 id="celebrate-heading">All set for {eventTitle(data)}!</h2>
          <p className="muted">Every task is done. Enjoy the celebration.</p>
          <div className="row no-print">
            {shareUrl ? (
              <CopyButton text={shareUrl} label="team link" />
            ) : (
              onShare && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void act(onShare, "Creating your team link…", "Team link ready")}
                >
                  Share with my team
                </button>
              )
            )}
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              Download PDF
            </button>
          </div>
        </section>
      ) : (
        <DoNextSection items={upNext} state={taskState} />
      )}

      {lastChange && (
        <section className="card what-changed no-print" aria-labelledby="changed-heading" ref={changeRef} tabIndex={-1}>
          <h2 id="changed-heading" className="section-title">
            What changed
          </h2>
          <ul className="list">
            {lastChange.lines.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ul>
          <p className="muted small">{lastChange.note}</p>
          <div className="row">
            <button type="button" className="btn" onClick={() => void undo()} disabled={busy}>
              Undo this change
            </button>
            <button type="button" className="btn btn-link" onClick={() => setLastChange(null)}>
              Keep it
            </button>
          </div>
        </section>
      )}

      {overBy > 0 && (
        <section className="over-banner no-print" aria-labelledby="over-heading">
          <h2 id="over-heading" className="small-heading">
            <span aria-hidden="true">⚠ </span>Bookings are {formatINR(overBy)} over budget
          </h2>
          <p className="small">Raise the budget or save elsewhere. Shubā shows you the choices.</p>
          <button type="button" className="btn btn-small" onClick={showChoices}>
            See my choices
          </button>
        </section>
      )}

      <div className="card">
        <Tabs items={tabs} label="Plan sections" activeId={tab} onActiveChange={setTab} />
      </div>

      <section className="card refine no-print" aria-labelledby="refine-heading">
        <h2 id="refine-heading" className="section-title">
          Change your plan
        </h2>
        <p className="muted">
          Plans change. Tell Shubā in your own words, such as more guests, a smaller budget or a new date, and it
          updates the whole plan without starting over.
        </p>
        <form onSubmit={refine} className="refine-form" aria-busy={busy}>
          <label htmlFor="refine-input" className="sr-only">
            What would you like to change?
          </label>
          <input
            id="refine-input"
            type="text"
            maxLength={LIMITS.maxInstruction}
            placeholder="e.g. Reduce the budget by 20%"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Working…" : "Update plan"}
          </button>
        </form>
        <div className="examples" role="group" aria-label="Suggestions">
          {REFINE_SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => setInstruction(s)}>
              {s}
            </button>
          ))}
        </div>
        {busy && (
          <p className="loading" aria-hidden="true">
            <span className="spinner" /> Shubā is working… this can take 10–20 seconds.
          </p>
        )}
      </section>
      {bloomItem && (
        <Bloom
          key={bloomItem.id}
          message={bloomMessage(bloomItem, bloomIndex)}
          petal={Math.max(1, petals)}
          onDone={finishBloom}
        />
      )}
    </article>
  );
}
