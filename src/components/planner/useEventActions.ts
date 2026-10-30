"use client";

import { useRouter } from "next/navigation";
import { listEvents, removeEvent, setCurrentEvent, type EventEntry } from "@/lib/myEvents";
import type { FormValues } from "../event-form/formValues";
import { savedWorkspace, type Mode } from "./savedWorkspace";
import type { Draft } from "./useDraft";
import type { RequestStatus } from "./useRequestStatus";
import type { SavedEvents } from "./useSavedEvents";

interface Deps {
  saved: SavedEvents;
  draft: Draft;
  status: RequestStatus;
  setMode: (mode: Mode) => void;
  setViewer: (viewer: string) => void;
  /** Moves focus to the heading of the screen now showing. */
  focusHeading: () => void;
}

/** Moving between screens: new event, My events, opening or removing an event, and the details form. */
export function useEventActions({ saved, draft, status, setMode, setViewer, focusHeading }: Deps) {
  const router = useRouter();

  /** Starts a new event. Events already planned stay in My events. */
  function startOver() {
    setCurrentEvent("");
    saved.close();
    draft.clear();
    status.setError("");
    setViewer("");
    setMode("voice");
  }

  function showEvents() {
    const list = listEvents();
    saved.setEvents(list);
    status.setError("");
    setMode(list.length ? "events" : "voice");
    focusHeading();
  }

  function openEvent(entry: EventEntry) {
    if (entry.sharedId) {
      setCurrentEvent("");
      router.push(`/p/${entry.sharedId}`);
      return;
    }
    const found = savedWorkspace(entry.key);
    if (!found) {
      removeEvent(entry.key);
      saved.setEvents(listEvents());
      status.setError("That plan could not be opened on this device, so it was removed from the list.");
      return;
    }
    setCurrentEvent(entry.key);
    saved.setEventKey(entry.key);
    saved.setWorkspace(found);
    setViewer("");
    status.setError("");
    setMode("plan");
  }

  function deleteEvent(entry: EventEntry) {
    removeEvent(entry.key);
    const list = listEvents();
    saved.setEvents(list);
    if (entry.key === saved.eventKey) saved.close();
    status.setAnnounce(`${entry.title} removed from this device`);
    if (!list.length) setMode("voice");
  }

  function openForm(values?: FormValues) {
    draft.open(values);
    status.setError("");
    setMode("form");
  }

  return { startOver, showEvents, openEvent, deleteEvent, openForm };
}
