"use client";

import { useRef, useState, type FormEvent } from "react";
import { ApiError, requestAssign, requestRefine } from "@/lib/client";
import type { Deal } from "@/lib/deals";
import { addIdeaToPlan, carryChosen, type IdeaState } from "@/lib/ideas";
import { applyRaise, type SavingOption, type SavingsRequest } from "@/lib/savings";
import { delayItem, delayLines, type ScheduledItem } from "@/lib/schedule";
import type { Idea, Plan } from "@/lib/schemas";
import type { Member } from "@/lib/team";
import type { DealState } from "../vendors/types";
import type { TaskState } from "./types";
import type { PlanDerived } from "./usePlanDerived";
import type { useAct } from "./useAct";
import type { Act, PlanWorkspaceProps, Snapshot } from "./workspaceTypes";

/** The last change shown in "What changed", with what to restore on Undo. */
export interface LastChange {
  lines: string[];
  before: Snapshot;
  note: string;
}

type Ctx = Pick<PlanWorkspaceProps, "data" | "onChange" | "onToggle" | "viewer" | "onViewerChange"> & {
  derived: PlanDerived;
  ideaState: IdeaState;
  run: ReturnType<typeof useAct>;
};

/** Every change the host can make on the plan screen, each with What changed and Undo where it applies. */
export function usePlanActions({ data, onChange, onToggle, viewer, onViewerChange, derived, ideaState, run }: Ctx) {
  const { input, plan, timings } = data;
  const { shifts, items, today, deals } = derived;
  const { act, setError } = run;
  const [instruction, setInstruction] = useState("");
  const [lastChange, setLastChange] = useState<LastChange | null>(null);
  const changeRef = useRef<HTMLElement>(null);

  /** Shows What changed and moves focus to it. */
  function showChange(change: LastChange) {
    setLastChange(change);
    requestAnimationFrame(() => changeRef.current?.focus());
  }

  /** Sends a change request in plain words and shows What changed with an Undo. */
  async function applyChange(text: string): Promise<boolean> {
    const before: Snapshot = { input, plan, timings, shifts };
    let lines: string[] = [];
    const ok = await act(
      async () => {
        const next = await requestRefine(input, plan, text);
        lines = next.changes?.length ? next.changes : ["Your plan has been updated."];
        // Ideas the host kept or added are never lost when the plan is rewritten.
        const ideas = { ...next.plan.ideas, items: carryChosen(plan.ideas.items, next.plan.ideas.items, ideaState) };
        // Keep quotes and bookings for vendors that are still in the refined plan.
        // A re-planned timeline starts fresh, so earlier delays are cleared.
        await onChange({
          input: next.input,
          plan: { ...next.plan, ideas },
          timings: next.timings,
          deals,
          shifts: {},
        });
      },
      "Updating your plan…",
      "Plan updated. See what changed on Home.",
    );
    if (ok) showChange({ lines, before, note: "Due dates, budget and vendor messages have been updated to match." });
    return ok;
  }

  async function refine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = instruction.trim();
    if (text.length < 3) {
      setError("Please describe what you want to change.");
      return;
    }
    if (await applyChange(text)) setInstruction("");
  }

  /** The host picked one of the over-budget choices. Raising the budget is done in code; the rest re-plan. */
  async function chooseSaving(option: SavingOption, request: SavingsRequest): Promise<boolean> {
    if (option.kind !== "raise-budget") return applyChange(option.instruction);
    const before: Snapshot = { input, plan };
    const raised = applyRaise(input, plan.budget, request.overLines);
    const ok = await act(
      () => onChange({ input: raised.input, plan: { ...plan, budget: raised.budget } }),
      "Updating the budget…",
      "Budget increased. See what changed on Home.",
    );
    if (ok) showChange({ lines: raised.changes, before, note: "Your bookings now fit the budget." });
    return ok;
  }

  async function undo() {
    if (!lastChange) return;
    const { before } = lastChange;
    const ok = await act(() => onChange(before), "Undoing…", "Last change undone");
    if (ok) setLastChange(null);
  }

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

  const wiring = teamWiring({ data, onChange, onToggle, viewer, onViewerChange, derived, act, setError });
  const taskState: TaskState = { ...wiring.taskState, onDelay: (item, days) => void delay(item, days) };

  return {
    ...wiring,
    taskState,
    instruction,
    setInstruction,
    lastChange,
    setLastChange,
    changeRef,
    applyChange,
    refine,
    chooseSaving,
    undo,
    addIdea,
  };
}

type WiringCtx = Pick<PlanWorkspaceProps, "data" | "onChange" | "onToggle" | "viewer" | "onViewerChange"> & {
  derived: PlanDerived;
  act: Act;
  setError: (message: string) => void;
};

/** Ticks, owners (the workspace adds onDelay), team changes, vendor deals and idea saves: the plain saves that need no What changed. */
function teamWiring({ data, onChange, onToggle, viewer, onViewerChange, derived, act, setError }: WiringCtx) {
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

/** What usePlanActions returns. */
export type PlanActions = ReturnType<typeof usePlanActions>;
