"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, loadGuests, type GuestsState } from "@/lib/client";
import type { Reply } from "@/lib/rsvp";

const POLL_MS = 30_000;

/**
 * Guest replies for a shared plan, with the guest link. They load, and refresh
 * every 30 seconds while the page is visible, only while `active` (the section is open).
 * `state` is null until the first load; `setState` takes the result of a guest-link action.
 */
export function useReplies(planId: string | null, active: boolean) {
  const [state, setState] = useState<GuestsState | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback((): Promise<void> => {
    if (!planId) return Promise.resolve();
    return loadGuests(planId).then(
      (next) => {
        setState(next);
        setError("");
      },
      (e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load guest replies."),
    );
  }, [planId]);

  useEffect(() => {
    if (!planId || !active) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [planId, active, refresh]);

  const replies: Reply[] = useMemo(() => state?.replies ?? [], [state]);
  return { replies, loaded: !planId || state !== null, error, refresh, state, setState, setError };
}
