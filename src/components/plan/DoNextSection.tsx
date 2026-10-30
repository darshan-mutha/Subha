"use client";

import type { ScheduledItem } from "@/lib/schedule";
import { TaskRow } from "./TaskRow";
import type { TaskState } from "./types";

/** The few most urgent unfinished tasks, across the timeline and vendor bookings. */
export function DoNextSection({ items, state }: { items: ScheduledItem[]; state: TaskState }) {
  const owner = state.team.find((m) => m.id === state.viewer);
  return (
    <section className="card do-next" aria-labelledby="do-next-heading">
      <h2 id="do-next-heading" className="section-title">
        Do next{owner ? ` · ${owner.name}` : ""}
      </h2>
      {items.length === 0 ? (
        <p className="muted">You&apos;re all caught up. Nothing is due right now.</p>
      ) : (
        <ul className="checklist">
          {items.map((item) => (
            <TaskRow key={item.id} item={item} state={state} idPrefix="next" showOwnerName={state.team.length > 0} />
          ))}
        </ul>
      )}
    </section>
  );
}
