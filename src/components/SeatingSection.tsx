"use client";

import { useId, useMemo } from "react";
import type { Reply } from "@/lib/rsvp";
import { planSeating, seatingText, tableLine, TABLE_SIZES, type Seating } from "@/lib/seating";
import { CopyButton } from "./PlanSections";

interface Props {
  replies: Reply[];
  seating: Seating;
  title: string;
  onChange: (next: Seating) => void;
}

/** Seating plan in the Guests tab, worked out from the replies. */
export function SeatingSection({ replies, seating, title, onChange }: Props) {
  const id = useId();
  const plan = useMemo(() => planSeating(replies, seating), [replies, seating]);
  const hasMaybe = replies.some((r) => r.coming === "maybe");
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
        Suggested from the replies: each family sits together, each side sits together, and guests who are elderly or
        use a wheelchair get the tables nearest the entrance. Move any family if you like.
      </p>

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
        <p className="hint">Tables appear here once guests reply that they are coming.</p>
      ) : (
        <>
          <p className="small" role="status">
            {plan.tables.length} {plan.tables.length === 1 ? "table" : "tables"} of {seating.tableSize} for{" "}
            {plan.people} {plan.people === 1 ? "person" : "people"} ({plan.families}{" "}
            {plan.families === 1 ? "family" : "families"}).
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
        </>
      )}
    </section>
  );
}
