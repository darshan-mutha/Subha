"use client";

import type { RefObject } from "react";
import { formatINR } from "@/lib/budget";
import { EVENT_TYPE_LABELS, type EventInput } from "@/lib/schemas";
import { WeatherCard } from "../WeatherCard";
import { PetalMark, Toran } from "../Brand";
import { formatDate } from "./eventTitle";
import type { LastChange } from "./usePlanActions";

/** The plan header: event type, name, rangoli progress, key facts, weather and the parent's notice. */
export function PlanHeader({
  input,
  headingRef,
  complete,
  petals,
  progress,
  milestonesDone,
  milestoneCount,
  notice,
}: {
  input: EventInput;
  headingRef: RefObject<HTMLHeadingElement | null>;
  complete: boolean;
  petals: number;
  progress: number;
  milestonesDone: number;
  milestoneCount: number;
  notice: string;
}) {
  return (
    <header className="card plan-header">
      {complete && <Toran />}
      <div className="plan-header-top">
        <div>
          <p className="eyebrow">{EVENT_TYPE_LABELS[input.eventType]}</p>
          <h2 id="plan-heading" ref={headingRef} tabIndex={-1}>
            {input.eventName || `Your ${EVENT_TYPE_LABELS[input.eventType].toLowerCase()} plan`}
          </h2>
        </div>
        <PetalMark size={88} filled={petals} className="rangoli" />
      </div>
      <p className="small muted progress-line">
        {Math.round(progress * 100)}% done
        {milestoneCount > 0 && ` · ${milestonesDone} of ${milestoneCount} milestones`}
      </p>
      <ul className="facts" aria-label="Event details">
        <li>
          {formatDate(input.date)}
          {input.days > 1 && ` · ${input.days} days`}
        </li>
        <li>{input.city}</li>
        <li>{input.guests.toLocaleString("en-IN")} guests</li>
        <li>{formatINR(input.budget)}</li>
      </ul>
      <WeatherCard city={input.city} date={input.date} days={input.days ?? 1} />
      {notice && (
        <p className="small muted" role="status">
          {notice}
        </p>
      )}
    </header>
  );
}

/** "What changed" after an update, with Undo and Keep it. */
export function WhatChanged({
  change,
  changeRef,
  busy,
  onUndo,
  onKeep,
}: {
  change: LastChange;
  changeRef: RefObject<HTMLElement | null>;
  busy: boolean;
  onUndo: () => void;
  onKeep: () => void;
}) {
  return (
    <section className="card what-changed no-print" aria-labelledby="changed-heading" ref={changeRef} tabIndex={-1}>
      <h2 id="changed-heading" className="section-title">
        What changed
      </h2>
      <ul className="list">
        {change.lines.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
      <p className="muted small">{change.note}</p>
      <div className="row">
        <button type="button" className="btn" onClick={onUndo} disabled={busy}>
          Undo this change
        </button>
        <button type="button" className="btn btn-link" onClick={onKeep}>
          Keep it
        </button>
      </div>
    </section>
  );
}

/** Warns that bookings are over budget, with a link to the choices. */
export function OverBudgetBanner({ overBy, onShowChoices }: { overBy: number; onShowChoices: () => void }) {
  return (
    <section className="over-banner no-print" aria-labelledby="over-heading">
      <h2 id="over-heading" className="small-heading">
        <span aria-hidden="true">⚠ </span>Bookings are {formatINR(overBy)} over budget
      </h2>
      <p className="small">Raise the budget or save elsewhere. Shubā shows you the choices.</p>
      <button type="button" className="btn btn-small" onClick={onShowChoices}>
        See my choices
      </button>
    </section>
  );
}
