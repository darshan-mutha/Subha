"use client";

import { ApiError, requestAssign } from "@/lib/client";
import type { Deal } from "@/lib/deals";
import type { IdeaState } from "@/lib/ideas/schema";
import type { Plan } from "@/lib/schemas";
import type { Member } from "@/lib/team";
import type { DealState } from "../vendors/types";
import type { TaskState } from "./types";
import type { PlanDerived } from "./usePlanDerived";
import type { Act, PlanWorkspaceProps } from "./workspaceTypes";

type WiringCtx = Pick<PlanWorkspaceProps, "data" | "onChange" | "onToggle" | "viewer" | "onViewerChange"> & {
  derived: PlanDerived;
  act: Act;
  setError: (message: string) => void;
};

/** Ticks, owners (the workspace adds onDelay), team changes, vendor deals and idea saves: the plain saves that need no What changed. */
export function planWiring({ data, onChange, onToggle, viewer, onViewerChange, derived, act, setError }: WiringCtx) {
  const { input, plan, team, assignments, done } = data;
  const { today, deals, vendorRefs } = derived;

  /** Saves the Ideas section's choices (and a new theme or ideas). Errors show at the top. */
  async function saveIdeas(next: { plan?: Plan; ideaState: IdeaState }) {
    try {
      setError("");
      await onChange(next.plan ? { plan: next.plan, ideaState: next.ideaState } : { ideaState: next.ideaState });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
      throw e;
    }
  }

  const autoAssign = () =>
    act(
      async () => {
        const { assignments: next } = await requestAssign(input, plan, team);
        await onChange({ assignments: next });
      },
      "Dividing the tasks…",
      "Tasks divided among your team",
    );

  const changeTeam = (next: Member[]) => {
    const ids = new Set(next.map((m) => m.id));
    const kept = Object.fromEntries(Object.entries(assignments).filter(([, m]) => ids.has(m)));
    if (viewer && !ids.has(viewer)) onViewerChange("");
    return act(() => onChange({ team: next, assignments: kept }), "Saving…", "Team updated");
  };

  const taskState: TaskState = {
    done,
    onToggle,
    team,
    assignments,
    viewer,
    today,
    eventDate: input.date,
    onAssign: (itemId, memberId) => {
      const next = { ...assignments };
      if (memberId) next[itemId] = memberId;
      else delete next[itemId];
      void act(() => onChange({ assignments: next }), "Saving…", "Saved");
    },
  };

  const dealState: DealState = {
    deals,
    input,
    budget: plan.budget,
    vendors: vendorRefs,
    onDeal: (vendorId: string, deal: Deal) => onChange({ deals: { ...deals, [vendorId]: deal } }),
    onBooked: (vendorId: string, isBooked: boolean) => {
      if (Boolean(done[vendorId]) !== isBooked) onToggle(vendorId, isBooked);
    },
  };

  return { saveIdeas, autoAssign, changeTeam, taskState, dealState };
}
