"use client";

import { useRef, useState, type FormEvent } from "react";
import { requestRefine } from "@/lib/client";
import type { IdeaState } from "@/lib/ideas/schema";
import { carryChosen } from "@/lib/ideas/state";
import { applyRaise } from "@/lib/savings/options";
import type { SavingOption, SavingsRequest } from "@/lib/savings/schema";
import type { TaskState } from "./types";
import type { PlanDerived } from "./usePlanDerived";
import type { useAct } from "./useAct";
import { planWiring } from "./planWiring";
import { useLocalChanges } from "./useLocalChanges";
import type { LastChange, PlanWorkspaceProps, Snapshot } from "./workspaceTypes";

export type { LastChange };

type Ctx = Pick<PlanWorkspaceProps, "data" | "onChange" | "onToggle" | "viewer" | "onViewerChange"> & {
  derived: PlanDerived;
  ideaState: IdeaState;
  run: ReturnType<typeof useAct>;
};

/** Every change the host can make on the plan screen, each with What changed and Undo where it applies. */
export function usePlanActions({ data, onChange, onToggle, viewer, onViewerChange, derived, ideaState, run }: Ctx) {
  const { input, plan, timings } = data;
  const { shifts, deals } = derived;
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

  const { delay, addIdea } = useLocalChanges({ data, derived, ideaState, act, onChange, showChange });

  const wiring = planWiring({ data, onChange, onToggle, viewer, onViewerChange, derived, act, setError });
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

/** What usePlanActions returns. */
export type PlanActions = ReturnType<typeof usePlanActions>;
