"use client";

import { addIdeaToPlan } from "@/lib/ideas/addToPlan";
import type { IdeaState } from "@/lib/ideas/schema";
import { delayItem, delayLines, type ScheduledItem } from "@/lib/schedule";
import type { Idea } from "@/lib/schemas";
import type { PlanDerived } from "./usePlanDerived";
import type { Act, LastChange, PlanWorkspaceProps, Snapshot } from "./workspaceTypes";

type LocalCtx = Pick<PlanWorkspaceProps, "data" | "onChange"> & {
  derived: PlanDerived;
  ideaState: IdeaState;
  act: Act;
  showChange: (change: LastChange) => void;
};

/** Changes worked out in code (no AI): a task running late, and an idea added to the plan. Both offer Undo. */
export function useLocalChanges({ data, derived, ideaState, act, onChange, showChange }: LocalCtx) {
  const { input, plan } = data;
  const { shifts, items, today } = derived;

  /** A task is running late: move it and the tasks after it, then show what moved with an Undo. */
  async function delay(item: ScheduledItem, days: number) {
    const result = delayItem(items, shifts, item.id, days, today, input.date);
    if (!result) return;
    const before: Snapshot = { shifts };
    const moved = result.later.length;
    const ok = await act(
      () => onChange({ shifts: result.shifts }),
      "Moving tasks…",
      `Moved ${moved + 1} ${moved === 0 ? "task" : "tasks"}. See what changed on Home.`,
    );
    if (ok) {
      showChange({
        lines: delayLines(result),
        before,
        note: "Due dates and the Do next list have been updated. Tasks already done did not move.",
      });
    }
  }

  /** An idea becomes a task, a budget amount and a line in a vendor's message, with Undo. */
  async function addIdea(idea: Idea, nextState: IdeaState) {
    const before: Snapshot = { plan, ideaState };
    const result = addIdeaToPlan(plan, input, idea, today);
    const ok = await act(
      () => onChange({ plan: result.plan, ideaState: nextState }),
      "Adding to your plan…",
      `${idea.title} is now in your plan. See what changed above the sections.`,
    );
    if (ok) {
      showChange({
        lines: result.lines.length ? result.lines : [`${idea.title} is now in your plan.`],
        before,
        note: "Costs are estimates. You can change any amount in the Budget section.",
      });
    }
  }

  return { delay, addIdea };
}
