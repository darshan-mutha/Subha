"use client";

import { WeatherCard } from "./WeatherCard";
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
  FunctionsSection,
  FunctionsSummary,
  TimelineSection,
  TimingsSection,
  VendorsSection,
  type TaskState,
} from "./PlanSections";
import type { TabItem } from "./Tabs";
import { TeamPanel } from "./TeamPanel";
import { InviteMaker } from "./InviteMaker";
import { GuestsHub } from "./GuestsHub";
import { useReplies } from "./useReplies";
import { DEFAULT_SEATING } from "@/lib/seating";
import { PetalMark, Toran } from "./Brand";
import { Bloom } from "./Celebrate";
import { CopyButton } from "./PlanSections";
import { SavingsChoices } from "./SavingsChoices";
import { SectionNav, type NavAction } from "./SectionNav";
import { IdeasPanel } from "./IdeasPanel";
import { addIdeaToPlan, carryChosen, EMPTY_IDEA_STATE, type IdeaState } from "@/lib/ideas";
import type { Idea, Plan } from "@/lib/schemas";
import { TRADITION_LABELS } from "@/lib/traditions";
import { applyRaise, overLines, totalOver, type SavingOption, type SavingsRequest } from "@/lib/savings";

const REFINE_SUGGESTIONS = [
  "We added 50 guests, the budget is 10% lower and the date moved 2 weeks earlier",
  "Reduce the budget by 20%",
  "Move the event 1 week later",
  "Make it eco-friendly",
];

/** Order of the plan sections in the navigation. */
const SECTION_ORDER = [
  "home",
  "budget",
  "timeline",
  "guests",
  "functions",
  "ideas",
  "vendors",
  "invite",
  "team",
  "timings",
];

/** The plan as it was before the last change, so the host can undo it. */
type Snapshot = Partial<SharedPlanContent>;

/** e.g. "Wednesday, 27 October 2027". */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "UTC" }).format(
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
  /** The shared plan's id (for guest replies), or null while the plan is only on this device. */
  planId?: string | null;
  /** Tab to open first, e.g. "guests" after getting the guest link. */
  initialTab?: string;
  /** Saves changes to plan content (team, owners, refined plan). */
  onChange: (content: Partial<SharedPlanContent>) => Promise<void>;
  onToggle: (itemId: string, done: boolean) => void;
  /** Saves the plan online for the team. `openTab` is the tab to show once it opens. */
  onShare: ((openTab?: string) => Promise<void>) | null;
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
  planId = null,
  initialTab = "home",
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
  const ideaState: IdeaState = data.ideaState ?? EMPTY_IDEA_STATE;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [announce, setAnnounce] = useState("");
  const [lastChange, setLastChange] = useState<{ lines: string[]; before: Snapshot; note: string } | null>(null);
  const changeRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
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
  const [tab, setTab] = useState(initialTab);
  // "Seat this function" reopens Guests on its Seating part.
  const [guestsOpen, setGuestsOpen] = useState<{ part: "list" | "replies" | "seating"; n: number } | null>(null);
  const { replies: fnReplies } = useReplies(planId, tab === "functions");

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
        // Ideas the host kept or added are never lost when the plan is rewritten.
        const ideas = { ...next.plan.ideas, items: carryChosen(plan.ideas.items, next.plan.ideas.items, ideaState) };
        // Keep quotes and bookings for vendors that are still in the refined plan.
        // A re-planned timeline starts fresh, so earlier delays are cleared.
        await onChange({
          input: next.input,
          plan: { ...next.plan, ideas },
          timings: next.timings,
          deals,
          shifts: {},
        });
      },
      "Updating your plan…",
      "Plan updated. See what changed on Home.",
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
      "Budget increased. See what changed on Home.",
    );
    if (ok) {
      setLastChange({ lines: raised.changes, before, note: "Your bookings now fit the budget." });
      requestAnimationFrame(() => changeRef.current?.focus());
    }
    return ok;
  }

  /** Opens a section, brings it into view if it is off screen, and moves focus to it. */
  function goTo(id: string) {
    setTab(id);
    requestAnimationFrame(() => {
      const box = tabsRef.current;
      if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView?.({ block: "start" });
      document.getElementById(`section-${id}`)?.focus({ preventScroll: true });
    });
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
      `Moved ${moved + 1} ${moved === 0 ? "task" : "tasks"}. See what changed on Home.`,
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

  /** Saves the Ideas section's choices (and a new theme or ideas). Errors show at the top. */
  async function saveIdeas(next: { plan?: Plan; ideaState: IdeaState }) {
    try {
      setError("");
      await onChange(next.plan ? { plan: next.plan, ideaState: next.ideaState } : { ideaState: next.ideaState });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
      throw e;
    }
  }

  /** An idea becomes a task, a budget amount and a line in a vendor's message, with Undo. */
  async function addIdea(idea: Idea, nextState: IdeaState) {
    const before: Snapshot = { plan, ideaState };
    const result = addIdeaToPlan(plan, input, idea, today);
    const ok = await act(
      () => onChange({ plan: result.plan, ideaState: nextState }),
      "Adding to your plan…",
      `${idea.title} is now in your plan. See what changed above the sections.`,
    );
    if (ok) {
      setLastChange({
        lines: result.lines.length ? result.lines : [`${idea.title} is now in your plan.`],
        before,
        note: "Costs are estimates. You can change any amount in the Budget section.",
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
      id: "home",
      label: "Home",
      content: (
        <>
          <section className="plan-about" aria-labelledby="about-heading">
            <h2 id="about-heading" className="sr-only">
              About this plan
            </h2>
            <p className="summary">{plan.summary}</p>
            {(input.focus?.length > 0 ||
              input.food ||
              input.guestNeeds?.length > 0 ||
              input.traditions?.length > 0) && (
              <ul className="personal-facts" aria-label="What this plan is shaped around">
                {input.traditions?.length > 0 && (
                  <li>
                    {input.traditions
                      .map((t) => (t === "other" ? input.traditionOther || "Other" : TRADITION_LABELS[t]))
                      .join(" & ")}
                  </li>
                )}
                {input.focus?.length > 0 && <li>Matters most: {input.focus.map((f) => FOCUS_LABELS[f]).join(", ")}</li>}
                {input.food && <li>Food: {FOOD_LABELS[input.food]}</li>}
                {input.guestNeeds?.map((g) => (
                  <li key={g}>{GUEST_NEED_LABELS[g]}</li>
                ))}
              </ul>
            )}
          </section>
          <FunctionsSummary
            plan={plan}
            firstDay={input.date}
            entries={data.guestList ?? []}
            onOpen={() => goTo("functions")}
          />
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

          <section className="refine no-print" aria-labelledby="refine-heading">
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
                <span className="spinner" /> Shubā is updating the whole plan… about 25–35 seconds.
              </p>
            )}
          </section>
        </>
      ),
    },
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
    {
      id: "ideas",
      label: "Ideas",
      content: (
        <IdeasPanel
          input={input}
          plan={plan}
          state={data.ideaState}
          onSave={saveIdeas}
          onAdd={(idea, next) => addIdea(idea, next)}
        />
      ),
    },
    {
      id: "invite",
      label: "Invite",
      content: <InviteMaker input={input} invite={data.invite ?? null} onSave={(invite) => onChange({ invite })} />,
    },
    {
      id: "guests",
      label: "Guests",
      content: (
        <GuestsHub
          key={guestsOpen?.n ?? 0}
          planId={planId}
          active={tab === "guests"}
          input={input}
          title={eventTitle(data)}
          invite={data.invite ?? null}
          busy={busy}
          onShare={
            onShare ? () => void act(() => onShare("guests"), "Creating your guest link…", "Guest link ready") : null
          }
          seating={data.seating}
          onSeating={(seating) => void act(() => onChange({ seating }), "Saving…", "Seating saved")}
          onUseGuests={(guests) =>
            void applyChange(`Change the guest count to ${guests}, based on the guest list and replies.`)
          }
          entries={data.guestList ?? []}
          functions={(plan.functions ?? []).map((f) => f.name)}
          today={today}
          onList={(guestList) => void act(() => onChange({ guestList }), "Saving…", "Guest list saved")}
          initialPart={guestsOpen?.part ?? (initialTab === "guests" ? "replies" : "list")}
        />
      ),
    },
  ];
  tabs.push({
    id: "team",
    label: "Team",
    content: (
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
    ),
  });
  if (timings) tabs.push({ id: "timings", label: "Timings", content: <TimingsSection timings={timings} /> });
  if (plan.functions.length > 0)
    tabs.push({
      id: "functions",
      label: "Functions",
      content: (
        <FunctionsSection
          plan={plan}
          firstDay={input.date}
          entries={data.guestList ?? []}
          replies={fnReplies}
          busy={busy}
          onPlanFor={(fn, guests) =>
            void applyChange(
              `Plan the ${fn} for ${guests} guests, based on the guest list. Keep the other functions as they are.`,
            )
          }
          onSeat={(fn) => {
            void act(() => onChange({ seating: { ...(data.seating ?? DEFAULT_SEATING), fn } }), "Saving…", "");
            setGuestsOpen((g) => ({ part: "seating", n: (g?.n ?? 0) + 1 }));
            goTo("guests");
          }}
        />
      ),
    });
  tabs.sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id));
  // A section that is not in this plan (e.g. Timings) falls back to Home.
  const current = tabs.some((t) => t.id === tab) ? tab : "home";

  const navActions: NavAction[] = [
    ...(onEdit ? [{ label: "Edit details", onClick: onEdit }] : []),
    { label: "Download PDF / Print", onClick: () => window.print() },
    ...(onMyEvents ? [{ label: eventCount > 1 ? `My events (${eventCount})` : "My events", onClick: onMyEvents }] : []),
    { label: "Plan a new event", onClick: onStartOver },
  ];

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
          <li>
            {formatDate(input.date)}
            {input.days > 1 && ` · ${input.days} days`}
          </li>
          <li>{input.city}</li>
          <li>{input.guests.toLocaleString("en-IN")} guests</li>
          <li>{formatINR(input.budget)}</li>
        </ul>
        <WeatherCard city={input.city} date={input.date} days={input.days ?? 1} />
        {notice && (
          <p className="small muted" role="status">
            {notice}
          </p>
        )}
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
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

      <div className="card plan-tabs" ref={tabsRef}>
        <SectionNav
          sections={tabs.map(({ id, label }) => ({ id, label }))}
          active={current}
          onPick={goTo}
          actions={navActions}
        />
        {tabs.map((t) => (
          <section
            key={t.id}
            id={`section-${t.id}`}
            aria-label={t.label}
            hidden={t.id !== current}
            tabIndex={-1}
            className="tabpanel section-panel"
            data-print-title={t.label}
          >
            {t.content}
          </section>
        ))}
      </div>

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
