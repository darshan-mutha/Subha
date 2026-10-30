"use client";

import { useState } from "react";
import { sortEvents, type EventEntry } from "@/lib/myEvents";
import { daysBetween, shortDateWithYear, todayIST } from "@/lib/dates";
import { EVENT_TYPE_LABELS } from "@/lib/schemas";

/** "In 12 days", "Tomorrow", "Today", "Done" (in the past). */
export function countdown(date: string, today: string): string {
  const days = daysBetween(today, date);
  if (!Number.isFinite(days)) return "";
  if (days < 0) return "Over";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

interface Props {
  events: EventEntry[];
  /** Key of the event open right now, if any. */
  current?: string;
  onOpen: (event: EventEntry) => void;
  onRemove: (event: EventEntry) => void;
  onNew: () => void;
}

/** The list of celebrations kept on this device. */
export function MyEvents({ events, current = "", onOpen, onRemove, onNew }: Props) {
  const [confirming, setConfirming] = useState("");
  const today = todayIST();
  const sorted = sortEvents(events, today);

  return (
    <section className="card my-events" aria-labelledby="my-events-heading">
      <div className="my-events-head">
        <h2 id="my-events-heading" className="section-title" tabIndex={-1}>
          My events
        </h2>
        <button type="button" className="btn btn-primary" onClick={onNew}>
          <span aria-hidden="true">+ </span>Plan a new event
        </button>
      </div>
      <p className="muted small">
        Kept on this device. Events shared with your team also open from their team link on any phone.
      </p>
      <ul className="event-list" role="list">
        {sorted.map((event) => {
          const label = EVENT_TYPE_LABELS[event.eventType];
          const when = countdown(event.date, today);
          return (
            <li key={event.key} className={`event-row${event.key === current ? " is-current" : ""}`}>
              <div className="event-info">
                <h3>{event.title}</h3>
                <p className="small muted">
                  {[event.title !== label && label, shortDateWithYear(event.date), event.city]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="event-tags small">
                  {when && <span className={`chip-label${when === "Over" ? " is-past" : ""}`}>{when}</span>}
                  {event.sharedId && <span className="chip-label is-shared">Shared with team</span>}
                </p>
              </div>
              {confirming === event.key ? (
                <div className="event-confirm" role="group" aria-label={`Remove ${event.title}?`}>
                  <p className="small">
                    {event.sharedId
                      ? "Remove from this device? Your team can still open it from the team link."
                      : "Remove this plan from this device? This cannot be undone."}
                  </p>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => {
                        setConfirming("");
                        onRemove(event);
                      }}
                    >
                      Yes, remove
                    </button>
                    <button type="button" className="btn btn-small btn-link" onClick={() => setConfirming("")}>
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row event-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => onOpen(event)}
                    aria-label={`Open ${event.title}`}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-link"
                    onClick={() => setConfirming(event.key)}
                    aria-label={`Remove ${event.title}`}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
