"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiStatusError, loadShared, loadViewer, saveProgress, saveViewer, updateShared } from "@/lib/client";
import { rememberShared } from "@/lib/myEvents";
import type { SharedPlan, SharedPlanContent } from "@/lib/team";
import { PlanWorkspace } from "./PlanWorkspace";

const POLL_MS = 15_000;

function contentOf(plan: SharedPlan): SharedPlanContent {
  const {
    input,
    plan: p,
    timings,
    team,
    assignments,
    deals = {},
    invite = null,
    shifts = {},
    seating,
    ideaState,
    guestList,
  } = plan;
  return {
    input,
    plan: p,
    timings,
    team,
    assignments,
    deals,
    invite,
    shifts,
    ...(seating ? { seating } : {}),
    ...(ideaState ? { ideaState } : {}),
    ...(guestList ? { guestList } : {}),
  };
}

/**
 * Loads a shared plan, refreshes it every 15 seconds while the page is visible,
 * and saves changes and ticks. Changes show at once and are saved in order.
 */
function useSharedPlan(id: string, setNotice: (notice: string) => void) {
  const [shared, setShared] = useState<SharedPlan | null>(null);
  const [error, setError] = useState("");
  /** Saves still on their way to the server; a refresh then would undo them on screen. */
  const pending = useRef(0);
  const latest = useRef<SharedPlan | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    latest.current = shared;
  }, [shared]);

  /** Reloads the plan. `force` is for a save that just failed: that save no longer counts as pending. */
  const refresh = useCallback(
    ({ force = false }: { force?: boolean } = {}): Promise<void> => {
      const othersSaving = () => pending.current - (force ? 1 : 0) > 0;
      if (othersSaving()) return Promise.resolve(); // don't overwrite changes that are still saving
      return loadShared(id).then(
        (fresh) => {
          if (!othersSaving()) setShared(fresh);
          setError("");
        },
        (e: unknown) =>
          setError(e instanceof ApiStatusError ? e.message : "Could not load the plan. Please check your connection."),
      );
    },
    [id],
  );

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", `/p/${id}`);
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [id, refresh]);

  async function track<T>(task: () => Promise<T>): Promise<T> {
    pending.current++;
    try {
      return await task();
    } finally {
      pending.current--;
    }
  }

  /** Saves are queued so quick successive edits each use the newest version number. */
  function change(content: Partial<SharedPlanContent>): Promise<void> {
    setShared((s) => (s ? { ...s, ...content } : s));
    const run = queue.current.then(() =>
      track(async () => {
        const base = latest.current;
        if (!base) return;
        try {
          const saved = await updateShared(id, base.version, { ...contentOf(base), ...content });
          latest.current = saved;
          setShared(saved);
          setNotice("All changes saved");
        } catch (e) {
          await refresh({ force: true });
          throw e;
        }
      }),
    );
    queue.current = run.catch(() => undefined);
    return run;
  }

  function toggle(itemId: string, done: boolean) {
    setShared((s) => (s ? { ...s, done: { ...s.done, [itemId]: done } } : s));
    void track(() => saveProgress(id, itemId, done))
      .then(({ done: savedDone }) => setShared((s) => (s ? { ...s, done: savedDone } : s)))
      .catch(() => {
        setShared((s) => (s ? { ...s, done: { ...s.done, [itemId]: !done } } : s));
        setNotice("Could not save that tick. Please check your connection and try again.");
      });
  }

  return { shared, error, change, toggle };
}

/** The plan could not be loaded and there is nothing to show. */
function PlanUnavailable({ error }: { error: string }) {
  return (
    <div className="card">
      <h1 className="section-title">Plan not available</h1>
      <p role="alert">{error}</p>
      <Link className="btn btn-primary" href="/">
        Plan a new event
      </Link>
    </div>
  );
}

/** Shown while the plan loads for the first time. */
function PlanLoading() {
  return (
    <p className="loading" role="status">
      <span className="spinner" aria-hidden="true" /> Loading your plan…
    </p>
  );
}

/** The short note shown when the plan was just shared from this device. */
function firstNotice(isNew: boolean, initialTab?: string): string {
  if (!isNew) return "";
  return initialTab === "guests"
    ? "Your plan is saved online. Turn on guest replies below to get the link for guests."
    : "Your team link is ready. Send it to your helpers below.";
}

/**
 * A plan shared with the team: everyone with the link sees and updates the same plan.
 * Rendered in the browser only (see the page), as it reads the page URL and saved preferences.
 */
export function SharedPlanView({
  id,
  initialTab,
  isNew = false,
}: {
  id: string;
  /** Tab to open first, from the page address. */
  initialTab?: string;
  /** Just shared from this device: show a short note. */
  isNew?: boolean;
}) {
  const [notice, setNotice] = useState(() => firstNotice(isNew, initialTab));
  const { shared, error, change, toggle } = useSharedPlan(id, setNotice);
  const [viewer, setViewer] = useState(() => loadViewer(id));
  const router = useRouter();

  // Keep this plan in My events on this device, so it can be found again without the link.
  const sharedInput = shared?.input;
  useEffect(() => {
    if (sharedInput) rememberShared(id, sharedInput);
  }, [id, sharedInput]);

  if (error && !shared) return <PlanUnavailable error={error} />;
  if (!shared) return <PlanLoading />;

  return (
    <div className="shared-page">
      <h1 className="sr-only">Shared celebration plan</h1>
      <PlanWorkspace
        planKey={id}
        planId={id}
        initialTab={initialTab}
        data={shared}
        shareUrl={`${window.location.origin}/p/${id}`}
        viewer={viewer}
        onViewerChange={(m) => {
          setViewer(m);
          saveViewer(id, m);
        }}
        onChange={change}
        onToggle={toggle}
        onShare={null}
        onEdit={null}
        onStartOver={() => router.push("/?view=new")}
        onMyEvents={() => router.push("/?view=events")}
        notice={error || notice}
      />
    </div>
  );
}
