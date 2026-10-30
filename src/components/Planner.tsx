"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createShared } from "@/lib/client";
import { markShared, setCurrentEvent } from "@/lib/myEvents";
import type { SharedPlanContent } from "@/lib/team";
import { fromInput } from "./EventForm";
import { MyEvents } from "./MyEvents";
import { PlanWorkspace } from "./PlanWorkspace";
import { requestedView, type Mode } from "./planner/savedWorkspace";
import { DetailsScreen, ErrorAlert, LiveStatus, VoiceScreen } from "./planner/StartScreens";
import { useDraft } from "./planner/useDraft";
import { useEventActions } from "./planner/useEventActions";
import { usePlanRequests } from "./planner/usePlanRequests";
import { useRequestStatus } from "./planner/useRequestStatus";
import { useSavedEvents } from "./planner/useSavedEvents";

/**
 * Home page flow: voice note (or typed line, or form) → check details →
 * plan. Plans live in this browser ("My events") until the host shares them.
 * Rendered in the browser only (see page.tsx), so it can read saved data on first render.
 */
export function Planner() {
  const router = useRouter();
  const saved = useSavedEvents();
  const { events, eventKey, workspace } = saved;
  const draft = useDraft();
  const status = useRequestStatus();
  const [viewer, setViewer] = useState("");
  const [mode, setMode] = useState<Mode>(() => {
    const view = requestedView();
    if (view === "new") return "voice";
    if (workspace) return "plan";
    return events.length > 0 ? "events" : "voice";
  });
  const { create, understand } = usePlanRequests({ saved, draft, status, setMode });
  const actions = useEventActions({ saved, draft, status, setMode, setViewer });

  // Clear "?view=…" once read, so a reload opens the event the host is on.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", "/");
  }, []);

  const live = <LiveStatus text={status.announce} />;

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
          onChange={async (content: Partial<SharedPlanContent>) => saved.patch((w) => ({ ...w, ...content }))}
          onToggle={(itemId, isDone) => saved.patch((w) => ({ ...w, done: { ...w.done, [itemId]: isDone } }))}
          onShare={async (openTab?: string) => {
            const { done, ...content } = workspace;
            const { id } = await createShared(content, done);
            markShared(eventKey, id, workspace.input);
            setCurrentEvent("");
            router.push(`/p/${id}?new=1${openTab ? `&tab=${openTab}` : ""}`);
          }}
          onEdit={() => actions.openForm(fromInput(workspace.input))}
          onStartOver={actions.startOver}
          onMyEvents={actions.showEvents}
          eventCount={events.length}
        />
      </>
    );
  }

  if (mode === "events" && events.length > 0) {
    return (
      <>
        {live}
        <ErrorAlert error={status.error} />
        <MyEvents
          events={events}
          current={eventKey}
          onOpen={actions.openEvent}
          onRemove={actions.deleteEvent}
          onNew={actions.startOver}
        />
      </>
    );
  }

  if (mode === "voice") {
    return (
      <>
        {live}
        <VoiceScreen
          busy={status.busy}
          error={status.error}
          eventCount={events.length}
          onSubmit={understand}
          onUseForm={() => actions.openForm()}
          onMyEvents={actions.showEvents}
        />
      </>
    );
  }

  return (
    <>
      {live}
      <DetailsScreen
        hasPlan={Boolean(workspace)}
        heard={draft.heard}
        missing={draft.missing}
        error={status.error}
        formKey={draft.formKey}
        editing={draft.editing}
        busy={status.busy}
        fieldErrs={status.fieldErrs}
        onSubmit={create}
        onBackToPlan={() => setMode("plan")}
        onBackToVoice={() => {
          status.setError("");
          setMode("voice");
        }}
      />
    </>
  );
}
