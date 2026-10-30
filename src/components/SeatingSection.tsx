"use client";

import { useId, useMemo } from "react";
import type { Reply } from "@/lib/rsvp";
import type { GuestList } from "@/lib/guestList";
import { planSeating, seatingText, type Seating } from "@/lib/seating";
import { CopyButton } from "./plan/CopyButton";
import { NoTablesHint, SeatingControls, SeatingScope, SeatTable } from "./guests/SeatingParts";

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
        <SeatingScope id={id} seating={seating} fn={fn} functions={functions} hasList={hasList} onChange={onChange} />
      )}

      <SeatingControls id={id} seating={seating} hasMaybe={hasMaybe} onChange={onChange} />

      {plan.tables.length === 0 ? (
        <NoTablesHint hasList={hasList} from={seating.from} fn={fn} />
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
              <SeatTable
                key={table.number}
                id={id}
                table={table}
                tableSize={seating.tableSize}
                moves={seating.moves}
                tableChoices={tableChoices}
                tableCount={plan.tables.length}
                onMove={move}
              />
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
