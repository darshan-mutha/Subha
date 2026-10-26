"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, createShared, requestExtract, requestPlan, type LocalWorkspace } from "@/lib/client";
import {
  currentEvent,
  listEvents,
  loadEvent,
  markShared,
  newEventKey,
  removeEvent,
  saveEvent,
  setCurrentEvent,
  type EventEntry,
} from "@/lib/myEvents";
import { PlanSchema, withInputDefaults, type EventInput } from "@/lib/schemas";
import { IdeaStateSchema } from "@/lib/ideas";
import { DEFAULT_SEATING, SeatingSchema } from "@/lib/seating";
import { pruneDeals } from "@/lib/deals";
import { InviteSchema } from "@/lib/invite";
import { planStructure, pruneState, type SharedPlanContent } from "@/lib/team";
import { EMPTY_FORM, EventForm, fromInput, type FormValues } from "./EventForm";
import { MyEvents } from "./MyEvents";
import { PlanWorkspace } from "./PlanWorkspace";
import { VoiceStart, type VoicePayload } from "./VoiceStart";

/**
 * Home page flow: voice note (or typed line, or form) → check details →
 * plan. Plans live in this browser ("My events") until the host shares them.
 */
/** Reads an event saved in this browser, upgrading plans saved by older versions of Shubā. */
function savedWorkspace(key: string): LocalWorkspace | null {
  if (!key) return null;
  const saved = loadEvent(key);
  const plan = PlanSchema.safeParse(saved?.plan);
  if (!saved?.input || !plan.success) return null;
  const ideaState = IdeaStateSchema.safeParse(saved.ideaState);
  return {
    ...saved,
    input: withInputDefaults(saved.input),
    plan: plan.data,
    ...(ideaState.success ? { ideaState: ideaState.data } : {}),
    team: saved.team ?? [],
    assignments: saved.assignments ?? {},
    done: saved.done ?? {},
    timings: saved.timings ?? null,
    deals: saved.deals ?? {},
    shifts: saved.shifts ?? {},
    seating: SeatingSchema.catch(DEFAULT_SEATING).parse(saved.seating ?? DEFAULT_SEATING),
    invite: InviteSchema.nullable()
      .catch(null)
      .parse(saved.invite ?? null),
  };
}

/** Rendered in the browser only (see page.tsx), so it can read saved data on first render. */
type Mode = "voice" | "form" | "plan" | "events";

/** "/?view=events" opens the list, "/?view=new" starts a new event (used from shared plans). */
function requestedView(): string {
  return new URLSearchParams(window.location.search).get("view") ?? "";
}

export function Planner() {
  const router = useRouter();
  const [events, setEvents] = useState<EventEntry[]>(listEvents);
  const [eventKey, setEventKey] = useState(() => {
    const view = requestedView();
    if (view === "events" || view === "new") return "";
    const key = currentEvent();
    return savedWorkspace(key) ? key : "";
  });
  const [workspace, setWorkspace] = useState<LocalWorkspace | null>(() => savedWorkspace(eventKey));
  const [editing, setEditing] = useState<FormValues | undefined>(undefined);
  const [mode, setMode] = useState<Mode>(() => {
    const view = requestedView();
    if (view === "new") return "voice";
    if (workspace) return "plan";
    return events.length > 0 ? "events" : "voice";
  });
  const [heard, setHeard] = useState("");
  const [missing, setMissing] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [announce, setAnnounce] = useState("");
  const [viewer, setViewer] = useState("");

  // Clear "?view=…" once read, so a reload opens the event the host is on.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", "/");
  }, []);

  function persist(key: string, next: LocalWorkspace) {
    saveEvent(key, next);
    setCurrentEvent(key);
    setEvents(listEvents());
  }

  function update(next: LocalWorkspace, key: string) {
    setWorkspace(next);
    setEventKey(key);
    persist(key, next);
  }

  /** Applies a change to the latest workspace, so quick successive edits are not lost. */
  function patch(change: (current: LocalWorkspace) => LocalWorkspace) {
    setWorkspace((current) => {
      if (!current) return current;
      const next = change(current);
      // Only the plan's content changes here (not its name or date), so the list needs no refresh.
      saveEvent(eventKey, next);
      return next;
    });
  }

  async function create(input: EventInput) {
    setBusy(true);
    setError("");
    setFieldErrs({});
    setAnnounce("Creating your plan…");
    try {
      const result = await requestPlan(input);
      // Keep the team when re-planning after editing details.
      const team = workspace?.team ?? [];
      const kept = workspace ? pruneState(result.plan, team, workspace.assignments, workspace.done) : null;
      const deals = pruneDeals(
        workspace?.deals,
        planStructure(result.plan).vendors.map((v) => v.id),
      );
      // Editing an event keeps it; anything else is a new event in the list.
      const key = workspace && eventKey ? eventKey : newEventKey();
      update(
        {
          ...result,
          team,
          assignments: kept?.assignments ?? {},
          done: kept?.done ?? {},
          deals,
          // A new plan has a new timeline, so earlier delays no longer apply.
          shifts: {},
          invite: workspace?.invite ?? null,
        },
        key,
      );
      setEditing(undefined);
      setHeard("");
      setMissing({});
      setMode("plan");
      setAnnounce("Your plan is ready");
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError("Something went wrong. Please try again.");
      setError(err.message);
      setFieldErrs(err.fields);
      setAnnounce(""); // the visible alert announces the error
    } finally {
      setBusy(false);
    }
  }

  async function understand(payload: VoicePayload) {
    setBusy(true);
    setError("");
    setAnnounce("Understanding your event…");
    try {
      const result = await requestExtract(payload);
      if (!result.transcript && result.missing.length === 5) {
        throw new ApiError(
          "Shubā could not catch any details. Please try again, speaking a little closer to the microphone.",
        );
      }
      setEditing({ ...EMPTY_FORM, ...result.values });
      setMissing(Object.fromEntries(result.missing.map((f) => [f, "Shubā didn't catch this. Please fill it in."])));
      setHeard(result.transcript);
      setFormKey((k) => k + 1);
      setMode("form");
      setAnnounce(
        result.missing.length
          ? `Got it. Please fill in ${result.missing.length} missing detail${result.missing.length > 1 ? "s" : ""}.`
          : "Got it. Please check the details and create your plan.",
      );
      requestAnimationFrame(() => document.getElementById("start-heading")?.focus());
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
      setError(message);
      setAnnounce(""); // the visible alert announces the error
    } finally {
      setBusy(false);
    }
  }

  /** Starts a new event. Events already planned stay in My events. */
  function startOver() {
    setCurrentEvent("");
    setEventKey("");
    setWorkspace(null);
    setEditing(undefined);
    setHeard("");
    setMissing({});
    setError("");
    setViewer("");
    setMode("voice");
  }

  function showEvents() {
    const list = listEvents();
    setEvents(list);
    setError("");
    setMode(list.length ? "events" : "voice");
    requestAnimationFrame(() => document.getElementById(list.length ? "my-events-heading" : "start-heading")?.focus());
  }

  function openEvent(entry: EventEntry) {
    if (entry.sharedId) {
      setCurrentEvent("");
      router.push(`/p/${entry.sharedId}`);
      return;
    }
    const saved = savedWorkspace(entry.key);
    if (!saved) {
      removeEvent(entry.key);
      setEvents(listEvents());
      setError("That plan could not be opened on this device, so it was removed from the list.");
      return;
    }
    setCurrentEvent(entry.key);
    setEventKey(entry.key);
    setWorkspace(saved);
    setViewer("");
    setError("");
    setMode("plan");
  }

  function deleteEvent(entry: EventEntry) {
    removeEvent(entry.key);
    const list = listEvents();
    setEvents(list);
    if (entry.key === eventKey) {
      setEventKey("");
      setWorkspace(null);
    }
    setAnnounce(`${entry.title} removed from this device`);
    if (!list.length) setMode("voice");
  }

  function openForm(values?: FormValues) {
    setEditing(values);
    setHeard("");
    setMissing({});
    setError("");
    setFormKey((k) => k + 1);
    setMode("form");
  }

  const live = (
    <p className="sr-only" role="status" aria-live="polite">
      {announce}
    </p>
  );

  if (mode === "plan" && workspace) {
    return (
      <>
        {live}
        <PlanWorkspace
          key={eventKey}
          planKey={eventKey || "local"}
          data={workspace}
          shareUrl={null}
          viewer={viewer}
          onViewerChange={setViewer}
          onChange={async (content: Partial<SharedPlanContent>) => patch((w) => ({ ...w, ...content }))}
          onToggle={(itemId, isDone) => patch((w) => ({ ...w, done: { ...w.done, [itemId]: isDone } }))}
          onShare={async (openTab?: string) => {
            const { done, ...content } = workspace;
            const { id } = await createShared(content, done);
            markShared(eventKey, id, workspace.input);
            setCurrentEvent("");
            router.push(`/p/${id}?new=1${openTab ? `&tab=${openTab}` : ""}`);
          }}
          onEdit={() => openForm(fromInput(workspace.input))}
          onStartOver={startOver}
          onMyEvents={showEvents}
          eventCount={events.length}
        />
      </>
    );
  }

  if (mode === "events" && events.length > 0) {
    return (
      <>
        {live}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <MyEvents events={events} current={eventKey} onOpen={openEvent} onRemove={deleteEvent} onNew={startOver} />
      </>
    );
  }

  if (mode === "voice") {
    return (
      <>
        {live}
        <section aria-labelledby="start-heading">
          <h2 id="start-heading" className="section-title" tabIndex={-1}>
            Tell us about your celebration
          </h2>
          <VoiceStart busy={busy} error={error} onSubmit={understand} onUseForm={() => openForm()} />
        </section>
        {events.length > 0 && (
          <button type="button" className="btn btn-link" onClick={showEvents}>
            Back to my events ({events.length})
          </button>
        )}
      </>
    );
  }

  const fromVoice = Boolean(heard);
  return (
    <>
      {live}
      <section aria-labelledby="start-heading">
        <h2 id="start-heading" className="section-title" tabIndex={-1}>
          {workspace ? "Edit your event" : fromVoice ? "Check your details" : "Tell us about your celebration"}
        </h2>
        {fromVoice && (
          <div className="heard card-inner">
            <p className="small-heading">Shubā heard:</p>
            <blockquote>“{heard}”</blockquote>
            <p className="muted small">
              {Object.keys(missing).length
                ? "We filled in what we understood. Please complete the highlighted fields."
                : "We filled in everything we understood. Check the details and create your plan."}
            </p>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <EventForm
          key={formKey}
          initial={editing}
          initialErrors={missing}
          busy={busy}
          serverErrors={fieldErrs}
          onSubmit={create}
        />
        {workspace ? (
          <button type="button" className="btn btn-link" onClick={() => setMode("plan")}>
            Cancel and go back to my plan
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-link"
            onClick={() => {
              setError("");
              setMode("voice");
            }}
          >
            Use a voice note instead
          </button>
        )}
        {busy && (
          <p className="loading" aria-hidden="true">
            <span className="spinner" /> Shubā is planning… this takes about 20–30 seconds.
          </p>
        )}
      </section>
    </>
  );
}
