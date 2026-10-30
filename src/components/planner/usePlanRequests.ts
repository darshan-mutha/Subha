"use client";

import { ApiError, requestExtract, requestPlan } from "@/lib/client";
import { newEventKey } from "@/lib/myEvents";
import type { EventInput } from "@/lib/schemas";
import { pruneDeals } from "@/lib/deals";
import { planStructure, pruneState } from "@/lib/team";
import { EMPTY_FORM } from "../event-form/formValues";
import type { VoicePayload } from "../VoiceStart";
import type { Mode } from "./savedWorkspace";
import type { Draft } from "./useDraft";
import type { RequestStatus } from "./useRequestStatus";
import type { SavedEvents } from "./useSavedEvents";

interface Deps {
  saved: SavedEvents;
  draft: Draft;
  status: RequestStatus;
  setMode: (mode: Mode) => void;
  /** Moves focus to the heading of the screen now showing. */
  focusHeading: () => void;
}

/** The two server calls on the home page: make a plan from details, and understand a voice note. */
export function usePlanRequests({ saved, draft, status, setMode, focusHeading }: Deps) {
  const { workspace, eventKey } = saved;

  async function create(input: EventInput) {
    status.setBusy(true);
    status.setError("");
    status.setFieldErrs({});
    status.setAnnounce("Creating your plan…");
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
      saved.update(
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
      draft.clear();
      setMode("plan");
      status.setAnnounce("Your plan is ready");
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError("Something went wrong. Please try again.");
      status.setError(err.message);
      status.setFieldErrs(err.fields);
      status.setAnnounce(""); // the visible alert announces the error
    } finally {
      status.setBusy(false);
    }
  }

  async function understand(payload: VoicePayload) {
    status.setBusy(true);
    status.setError("");
    status.setAnnounce("Understanding your event…");
    try {
      const result = await requestExtract(payload);
      if (!result.transcript && result.missing.length === 5) {
        throw new ApiError(
          "Shubā could not catch any details. Please try again, speaking a little closer to the microphone.",
        );
      }
      draft.fromVoice(
        { ...EMPTY_FORM, ...result.values },
        Object.fromEntries(result.missing.map((f) => [f, "Shubā didn't catch this. Please fill it in."])),
        result.transcript,
      );
      setMode("form");
      status.setAnnounce(
        result.missing.length
          ? `Got it. Please fill in ${result.missing.length} missing detail${result.missing.length > 1 ? "s" : ""}.`
          : "Got it. Please check the details and create your plan.",
      );
      focusHeading();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
      status.setError(message);
      status.setAnnounce(""); // the visible alert announces the error
    } finally {
      status.setBusy(false);
    }
  }

  return { create, understand };
}
