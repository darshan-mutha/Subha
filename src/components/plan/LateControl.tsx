"use client";

import { useEffect, useRef, useState } from "react";
import { daysBetween, shortDate } from "@/lib/dates";
import { canDelay, DELAY_CHOICES, delayedDate } from "@/lib/delay";
import type { ScheduledItem } from "@/lib/schedule";
import type { TaskState } from "./types";

/** "Running late?" — pick a new date, and later tasks move with it. */
export function LateControl({ item, state, id }: { item: ScheduledItem; state: TaskState; id: string }) {
  const [open, setOpen] = useState(false);
  const { eventDate, onDelay, today } = state;
  const options = eventDate
    ? DELAY_CHOICES.map((days) => ({ days, date: delayedDate(item, days, today, eventDate) })).filter(
        (o, i, all) => o.date > item.due && all.findIndex((x) => x.date === o.date) === i,
      )
    : [];
  const [choice, setChoice] = useState(0);
  const selectRef = useRef<HTMLSelectElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Keyboard and screen-reader users land in the panel when it opens, and back on the button when it closes.
  useEffect(() => {
    if (open) selectRef.current?.focus();
    else if (wasOpen.current) toggleRef.current?.focus();
    wasOpen.current = open;
  }, [open]);
  if (!eventDate || !onDelay || !canDelay(item, eventDate) || options.length === 0) return null;
  const selected = options[Math.min(choice, options.length - 1)];
  if (!open) {
    return (
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-link btn-small late-toggle no-print"
        aria-expanded="false"
        aria-controls={`${id}-late`}
        aria-label={`Running late? ${item.label}`}
        onClick={() => setOpen(true)}
      >
        Running late?
      </button>
    );
  }
  return (
    <div
      className="late-panel no-print"
      id={`${id}-late`}
      role="group"
      aria-labelledby={`${id}-late-label`}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <label id={`${id}-late-label`} htmlFor={`${id}-late-date`}>
        When will “{item.label}” be done?
      </label>
      <select ref={selectRef} id={`${id}-late-date`} value={choice} onChange={(e) => setChoice(Number(e.target.value))}>
        {options.map((o, i) => (
          <option key={o.date} value={i}>
            By {shortDate(o.date)} ({daysBetween(item.due, o.date)} days later)
          </option>
        ))}
      </select>
      <p className="small muted">Tasks after this one will move by the same number of days. The event date stays.</p>
      <div className="row">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            setOpen(false);
            onDelay(item, selected.days);
          }}
        >
          Move it and later tasks
        </button>
        <button type="button" className="btn btn-link btn-small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
