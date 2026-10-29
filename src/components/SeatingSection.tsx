"use client";

import { useId, useMemo } from "react";
import type { Reply } from "@/lib/rsvp";
import type { GuestList } from "@/lib/guestList";
import { planSeating, seatingText, tableLine, TABLE_SIZES, type Seating } from "@/lib/seating";
import { CopyButton } from "./PlanSections";

interface Props {
  replies: Reply[];
  /** The host's guest list: families can be seated before they reply. */
  entries?: GuestList;
  /** The plan's functions, to seat one at a time. */
  functions?: string[];
  seating: Seating;
  title: string;
  onChange: (next: Seating) => void;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** Seating plan in the Guests section, worked out from the guest list and the replies. */
export function SeatingSection({ replies, entries = [], functions = [], seating, title, onChange }: Props) {
  const id = useId();
  const fn = functions.includes(seating.fn) ? seating.fn : "";
  const plan = useMemo(() => planSeating(replies, { ...seating, fn }, entries), [replies, seating, fn, entries]);
  const hasMaybe = replies.some((r) => r.coming === "maybe");
  const hasList = entries.length > 0;
  const movedCount = Object.keys(seating.moves).length;
  // Allow moving a family to any table, or to one new table at the end.
  const tableChoices = Array.from({ length: plan.tables.length + 1 }, (_, i) => i + 1);

  function move(replyId: string, value: string) {
    const moves = { ...seating.moves };
    if (value) moves[replyId] = Number(value);
    else delete moves[replyId];
    onChange({ ...seating, moves });
  }

  return (
    <section className="seating" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Seating plan</h3>
      <p className="small muted">
        Each family sits together, each side sits together, and guests who are elderly or use a wheelchair get the
        tables nearest the entrance. Move any family if you like.
      </p>

      {(hasList || functions.length > 0) && (
        <div className="seating-scope no-print">
          {hasList && (
            <>
              <p className="fn-label" id={`${id}-from`}>
                Seat
              </p>
              <div className="segmented" role="group" aria-labelledby={`${id}-from`}>
                <button
                  type="button"
                  aria-pressed={seating.from === "list"}
                  onClick={() => onChange({ ...seating, from: "list" })}
                >
                  Everyone on my list
                </button>
                <button
                  type="button"
                  aria-pressed={seating.from === "replies"}
                  onClick={() => onChange({ ...seating, from: "replies" })}
                >
                  Only those coming
                </button>
              </div>
            </>
          )}
          {functions.length > 0 && hasList && (
            <>
              <p className="fn-label" id={`${id}-fn`}>
                For
              </p>
              <div className="vs-filters" role="group" aria-labelledby={`${id}-fn`}>
                {["", ...functions].map((name) => (
                  <button
                    key={name || "all"}
                    type="button"
                    className={`chip${fn === name ? " is-on" : ""}`}
                    aria-pressed={fn === name}
                    onClick={() => onChange({ ...seating, fn: name })}
                  >
                    {name || "All functions"}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="seating-controls no-print">
        <div className="field">
          <label htmlFor={`${id}-size`}>People per table</label>
          <select
            id={`${id}-size`}
            value={seating.tableSize}
            onChange={(e) => onChange({ ...seating, tableSize: Number(e.target.value) })}
          >
            {TABLE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {hasMaybe && (
          <div className="choices">
            <label className="choice">
              <input
                type="checkbox"
                checked={seating.includeMaybe}
                onChange={(e) => onChange({ ...seating, includeMaybe: e.target.checked })}
              />
              Keep seats for &ldquo;maybe&rdquo; guests
            </label>
          </div>
        )}
      </div>

      {plan.tables.length === 0 ? (
        <p className="hint">
          {!hasList
            ? "Tables appear here once you add guests to your list, or guests reply that they are coming."
            : seating.from === "replies"
              ? `No one${fn ? ` invited to the ${fn}` : ""} has said yes yet. Choose “Everyone on my list” to seat them now.`
              : fn
                ? `No one on your list is invited to the ${fn}.`
                : "No one to seat yet: everyone on your list has said no."}
        </p>
      ) : (
        <>
          <p className="small" role="status">
            {plural(plan.tables.length, "table", "tables")} of {seating.tableSize} for{" "}
            {plural(plan.people, "person", "people")} ({plural(plan.families, "family", "families")})
            {fn ? ` at the ${fn}` : ""}.
            {plan.waiting > 0 &&
              (plan.replied === 0 ? (
                " No one has replied yet."
              ) : (
                <>
                  {" "}
                  <strong>{plan.replied.toLocaleString("en-IN")} said yes</strong>,{" "}
                  {plan.waiting.toLocaleString("en-IN")} {plan.waiting === 1 ? "has" : "have"} not replied yet.
                </>
              ))}
            {movedCount > 0 && ` You moved ${movedCount} ${movedCount === 1 ? "family" : "families"}.`}
          </p>
          <div className="row no-print">
            <CopyButton text={seatingText(title, plan)} label="seating plan" />
            {movedCount > 0 && (
              <button
                type="button"
                className="btn btn-small btn-link"
                onClick={() => onChange({ ...seating, moves: {} })}
              >
                Undo my moves
              </button>
            )}
          </div>
          <ol className="table-list" role="list">
            {plan.tables.map((table) => (
              <li key={table.number} className={`seat-table${table.over > 0 ? " is-over" : ""}`}>
                <div className="seat-table-head">
                  <h4>Table {table.number}</h4>
                  <span className="small">
                    {table.people} of {seating.tableSize} seats
                  </span>
                </div>
                {table.nearEntrance && (
                  <p className="chip-label">
                    <span aria-hidden="true">♿ </span>Near the entrance, step-free
                  </p>
                )}
                {table.over > 0 && (
                  <p className="over-budget small">
                    {table.over} more than the table holds. Move a family or add a chair.
                  </p>
                )}
                {tableLine(table) && <p className="small muted">{tableLine(table)}</p>}
                {table.kids > 0 && (
                  <p className="small muted">
                    {table.kids} {table.kids === 1 ? "child" : "children"}: keep a high chair or space nearby
                  </p>
                )}
                {table.seats.length === 0 ? (
                  <p className="small muted">Empty</p>
                ) : (
                  <ul className="seat-list" role="list">
                    {table.seats.map((seat) => (
                      <li key={`${seat.replyId}-${seat.part ?? ""}`}>
                        <span>
                          {seat.name} <span className="muted">({seat.people})</span>
                          {seat.part && <span className="muted small"> · part {seat.part}</span>}
                          {seat.maybe && <span className="muted small"> · maybe</span>}
                          {seat.waiting && <span className="muted small"> · no reply yet</span>}
                        </span>
                        {!seat.part && (
                          <span className="no-print">
                            <label className="sr-only" htmlFor={`${id}-${seat.replyId}`}>
                              Move {seat.name} to
                            </label>
                            <select
                              id={`${id}-${seat.replyId}`}
                              className="move-select"
                              value={seating.moves[seat.replyId] ?? ""}
                              onChange={(e) => move(seat.replyId, e.target.value)}
                            >
                              <option value="">{seat.moved ? "Back to suggested" : "Move to…"}</option>
                              {tableChoices
                                .filter((n) => n !== table.number || seat.moved)
                                .map((n) => (
                                  <option key={n} value={n}>
                                    Table {n}
                                    {n > plan.tables.length ? " (new)" : ""}
                                  </option>
                                ))}
                            </select>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {hasList && (
            <p className="small muted">
              Families who said no are left out. Food and access needs show once a family replies.
            </p>
          )}
        </>
      )}
    </section>
  );
}
