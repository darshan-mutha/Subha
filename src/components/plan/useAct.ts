"use client";

import { useState } from "react";
import { ApiError } from "@/lib/client";
import type { Act } from "./workspaceTypes";

/** Busy flag, error message and screen-reader announcement shared by every save on the plan screen. */
export function useAct() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");

  const act: Act = async (task, working, doneMessage) => {
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
  };

  return { busy, error, setError, announce, act };
}
