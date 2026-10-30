"use client";

import { useState } from "react";
import type { LocalWorkspace } from "@/lib/client";
import { currentEvent, listEvents, saveEvent, setCurrentEvent, type EventEntry } from "@/lib/myEvents";
import { requestedView, savedWorkspace } from "./savedWorkspace";

/** The events saved in this browser, which one is open, and its workspace. */
export function useSavedEvents() {
  const [events, setEvents] = useState<EventEntry[]>(listEvents);
  const [eventKey, setEventKey] = useState(() => {
    const view = requestedView();
    if (view === "events" || view === "new") return "";
    const key = currentEvent();
    return savedWorkspace(key) ? key : "";
  });
  const [workspace, setWorkspace] = useState<LocalWorkspace | null>(() => savedWorkspace(eventKey));

  /** Saves a workspace under a key, opens it and refreshes the list. */
  function update(next: LocalWorkspace, key: string) {
    setWorkspace(next);
    setEventKey(key);
    saveEvent(key, next);
    setCurrentEvent(key);
    setEvents(listEvents());
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

  /** Forgets which event is open (it stays saved in the list). */
  function close() {
    setEventKey("");
    setWorkspace(null);
  }

  return { events, setEvents, eventKey, setEventKey, workspace, setWorkspace, update, patch, close };
}

/** What `useSavedEvents` returns. */
export type SavedEvents = ReturnType<typeof useSavedEvents>;
