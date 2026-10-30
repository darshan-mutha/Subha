"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, loadGuests, type GuestsState } from "@/lib/client";

const POLL_MS = 30_000;

/** Loads a shared plan's guest link and replies, refreshing every 30 seconds while `active` and visible. */
export function useGuestsState(planId: string | null, active: boolean) {
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

  return { state, setState, error, setError, refresh };
}
