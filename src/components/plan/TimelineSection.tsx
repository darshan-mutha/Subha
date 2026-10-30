"use client";

import type { Plan } from "@/lib/schemas";
import { shortDate, type ScheduledItem } from "@/lib/schedule";
import type { PlanItem } from "@/lib/team";
import { TaskRow } from "./TaskRow";
import type { TaskState } from "./types";

function visible(item: PlanItem, state: TaskState): boolean {
  return !state.viewer || state.assignments[item.id] === state.viewer;
}

/** The plan's timeline, step by step, with each step's tasks as a checklist. */
export function TimelineSection({
  tasks,
  stepDue,
  plan,
  state,
}: {
  tasks: ScheduledItem[][];
  stepDue: string[];
  plan: Plan;
  state: TaskState;
}) {
  const steps = plan.timeline
    .map((step, i) => ({ step, due: stepDue[i], items: tasks[i].filter((t) => visible(t, state)) }))
    .filter(({ items }) => items.length > 0);
  return (
    <>
      <h2 className="section-title">Timeline</h2>
      {steps.length === 0 && <p className="muted">No tasks for this person yet.</p>}
      <ol className="timeline">
        {steps.map(({ step, due, items }, i) => (
          <li key={`${step.when}-${i}`}>
            <h3>
              {step.when} <span className="step-date">· {shortDate(due)}</span>
            </h3>
            <ul className="checklist">
              {items.map((item) => (
                <TaskRow key={item.id} item={item} state={state} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}
