"use client";

import { dueText, shiftText, type ScheduledItem } from "@/lib/schedule";
import type { PlanItem } from "@/lib/team";
import { LateControl } from "./LateControl";
import type { TaskState } from "./types";

const PRIORITY_LABEL: Record<ScheduledItem["priority"], string> = { high: "High", medium: "Medium", low: "Low" };

/** A task's priority as a small badge, with a screen-reader prefix. */
export function PriorityBadge({ priority }: { priority: ScheduledItem["priority"] }) {
  return (
    <span className={`badge priority-${priority}`}>
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

/** "Due in 3 days", "Overdue" and so on, coloured by status. */
export function DueLabel({ item, today }: { item: ScheduledItem; today: string }) {
  return <span className={`due due-${item.status}`}>{dueText(item, today)}</span>;
}

function OwnerPicker({ item, state }: { item: PlanItem; state: TaskState }) {
  if (state.team.length === 0) return null;
  return (
    <select
      className="owner"
      aria-label={`Who will do this: ${item.label}`}
      value={state.assignments[item.id] ?? ""}
      onChange={(e) => state.onAssign(item.id, e.target.value)}
    >
      <option value="">Unassigned</option>
      {state.team.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

/** One checklist row: tick box, label, priority, due date, owner and "Running late?". */
export function TaskRow({
  item,
  state,
  idPrefix = "item",
  showOwnerName = false,
}: {
  item: ScheduledItem;
  state: TaskState;
  idPrefix?: string;
  showOwnerName?: boolean;
}) {
  const id = `${idPrefix}-${item.id}`;
  const owner = state.team.find((m) => m.id === state.assignments[item.id]);
  return (
    <li className={`task-row status-${item.status}`}>
      <input
        type="checkbox"
        id={id}
        checked={Boolean(state.done[item.id])}
        onChange={(e) => state.onToggle(item.id, e.target.checked)}
        aria-describedby={`${id}-meta`}
      />
      <label htmlFor={id}>{item.kind === "task" ? item.label : <strong>{item.label}</strong>}</label>
      <span className="task-meta" id={`${id}-meta`}>
        <PriorityBadge priority={item.priority} />
        <DueLabel item={item} today={state.today} />
        {item.shifted > 0 && item.status !== "done" && (
          <span className="small muted shifted">{shiftText(item.shifted)}</span>
        )}
        {showOwnerName && <span className="small muted">{owner ? owner.name : "Unassigned"}</span>}
      </span>
      {!showOwnerName && <OwnerPicker item={item} state={state} />}
      <LateControl item={item} state={state} id={id} />
    </li>
  );
}
