"use client";

import { tableLine, TABLE_SIZES, type Seating, type Table } from "@/lib/seating";

/** Who to seat (list or replies) and which function, shown above the seating controls. */
export function SeatingScope({
  id,
  seating,
  fn,
  functions,
  hasList,
  onChange,
}: {
  id: string;
  seating: Seating;
  fn: string;
  functions: string[];
  hasList: boolean;
  onChange: (next: Seating) => void;
}) {
  return (
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
  );
}

/** People per table, and whether to keep seats for "maybe" guests. */
export function SeatingControls({
  id,
  seating,
  hasMaybe,
  onChange,
}: {
  id: string;
  seating: Seating;
  hasMaybe: boolean;
  onChange: (next: Seating) => void;
}) {
  return (
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
  );
}

/** Why no tables show yet, worded for the current scope. */
export function NoTablesHint({ hasList, from, fn }: { hasList: boolean; from: Seating["from"]; fn: string }) {
  return (
    <p className="hint">
      {!hasList
        ? "Tables appear here once you add guests to your list, or guests reply that they are coming."
        : from === "replies"
          ? `No one${fn ? ` invited to the ${fn}` : ""} has said yes yet. Choose “Everyone on my list” to seat them now.`
          : fn
            ? `No one on your list is invited to the ${fn}.`
            : "No one to seat yet: everyone on your list has said no."}
    </p>
  );
}

/** One table in the seating plan, with its families and a Move menu for each. */
export function SeatTable({
  id,
  table,
  tableSize,
  moves,
  tableChoices,
  tableCount,
  onMove,
}: {
  id: string;
  table: Table;
  tableSize: number;
  moves: Seating["moves"];
  tableChoices: number[];
  tableCount: number;
  onMove: (replyId: string, value: string) => void;
}) {
  return (
    <li className={`seat-table${table.over > 0 ? " is-over" : ""}`}>
      <div className="seat-table-head">
        <h4>Table {table.number}</h4>
        <span className="small">
          {table.people} of {tableSize} seats
        </span>
      </div>
      {table.nearEntrance && (
        <p className="chip-label">
          <span aria-hidden="true">♿ </span>Near the entrance, step-free
        </p>
      )}
      {table.over > 0 && (
        <p className="over-budget small">{table.over} more than the table holds. Move a family or add a chair.</p>
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
                    value={moves[seat.replyId] ?? ""}
                    onChange={(e) => onMove(seat.replyId, e.target.value)}
                  >
                    <option value="">{seat.moved ? "Back to suggested" : "Move to…"}</option>
                    {tableChoices
                      .filter((n) => n !== table.number || seat.moved)
                      .map((n) => (
                        <option key={n} value={n}>
                          Table {n}
                          {n > tableCount ? " (new)" : ""}
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
  );
}
