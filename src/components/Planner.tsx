"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ApiError,
  clearPlan,
  createShared,
  loadPlan,
  requestExtract,
  requestPlan,
  savePlan,
  type LocalWorkspace,
} from "@/lib/client";
import { PlanSchema, type EventInput } from "@/lib/schemas";
import { pruneDeals } from "@/lib/deals";
import { planStructure, pruneState, type SharedPlanContent } from "@/lib/team";
import { EventForm, fromInput, type FormValues } from "./EventForm";
import { PlanWorkspace } from "./PlanWorkspace";
import { VoiceStart, type VoicePayload } from "./VoiceStart";

/**
 * Home page flow: voice note (or typed line, or form) → check details →
 * plan. The plan lives in this browser until the host shares it.
 */
/** Reads the plan saved in this browser, upgrading plans saved by older versions of Shubā. */
function savedWorkspace(): LocalWorkspace | null {
  const saved = loadPlan();
  const plan = PlanSchema.safeParse(saved?.plan);
  if (!saved?.input || !plan.success) return null;
  return {
    ...saved,
    plan: plan.data,
    team: saved.team ?? [],
    assignments: saved.assignments ?? {},
    done: saved.done ?? {},
    timings: saved.timings ?? null,
    deals: saved.deals ?? {},
  };
}

/** Rendered in the browser only (see page.tsx), so it can read saved data on first render. */
export function Planner() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<LocalWorkspace | null>(savedWorkspace);
  const [editing, setEditing] = useState<FormValues | undefined>(undefined);
  const [mode, setMode] = useState<"voice" | "form" | "plan">(() => (workspace ? "plan" : "voice"));
  const [heard, setHeard] = useState("");
  const [missing, setMissing] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [announce, setAnnounce] = useState("");
  const [viewer, setViewer] = useState("");

  function update(next: LocalWorkspace) {
    setWorkspace(next);
    savePlan(next);
  }

  /** Applies a change to the latest workspace, so quick successive edits are not lost. */
  function patch(change: (current: LocalWorkspace) => LocalWorkspace) {
    setWorkspace((current) => {
      if (!current) return current;
      const next = change(current);
      savePlan(next);
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
      update({ ...result, team, assignments: kept?.assignments ?? {}, done: kept?.done ?? {}, deals });
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
      setEditing(result.values);
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

  function startOver() {
    clearPlan();
    setWorkspace(null);
    setEditing(undefined);
    setHeard("");
    setMissing({});
    setError("");
    setViewer("");
    setMode("voice");
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
          planKey="local"
          data={workspace}
          shareUrl={null}
          viewer={viewer}
          onViewerChange={setViewer}
          onChange={async (content: Partial<SharedPlanContent>) => patch((w) => ({ ...w, ...content }))}
          onToggle={(itemId, isDone) => patch((w) => ({ ...w, done: { ...w.done, [itemId]: isDone } }))}
          onShare={async () => {
            const { done, ...content } = workspace;
            const { id } = await createShared(content, done);
            clearPlan();
            router.push(`/p/${id}?new=1`);
          }}
          onEdit={() => openForm(fromInput(workspace.input))}
          onStartOver={startOver}
        />
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
            <span className="spinner" /> Shubā is planning… this takes about 10–20 seconds.
          </p>
        )}
      </section>
    </>
  );
}
