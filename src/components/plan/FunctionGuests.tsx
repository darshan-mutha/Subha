"use client";

import { functionCount, overInvited, type GuestList } from "@/lib/guestList";
import type { Reply } from "@/lib/rsvp";

/** Guest-list data and actions shared by the function cards. */
export interface FunctionGuestsProps {
  /** The host's guest list and the replies, for counts per function. */
  entries?: GuestList;
  replies?: Reply[];
  busy?: boolean;
  /** Re-plans one function for a new guest count (What changed + Undo). */
  onPlanFor?: (fn: string, guests: number) => void;
  /** Opens Guests → Seating for one function. */
  onSeat?: (fn: string) => void;
}

/** "From your guest list" on a function card: invited, coming, no reply. */
export function FunctionGuests({
  name,
  planned,
  entries,
  replies,
  busy,
  onPlanFor,
  onSeat,
}: { name: string; planned: number } & FunctionGuestsProps) {
  const count = functionCount(entries ?? [], replies ?? [], name);
  if (count.families === 0) return null;
  const pct = (n: number) => `${Math.min(100, Math.round((n / Math.max(1, count.invited)) * 100))}%`;
  const over = overInvited(count.invited, planned);
  const n = (x: number) => x.toLocaleString("en-IN");
  return (
    <div className="fn-guests">
      <p className="fn-label">From your guest list</p>
      <div
        className="fn-bar"
        role="img"
        aria-label={`${n(count.coming)} coming and ${n(count.waiting)} with no reply, of ${n(count.invited)} invited`}
      >
        <span className="is-coming" style={{ width: pct(count.coming) }} />
        <span className="is-waiting" style={{ width: pct(count.waiting) }} />
      </div>
      <p className="small">
        {n(count.invited)} invited · <strong>{n(count.coming)} coming</strong>
        {count.maybe > 0 && ` · ${n(count.maybe)} maybe`} · {n(count.waiting)} no reply
      </p>
      {over && (
        <p className="fn-warn small">
          {n(count.invited - planned)} more invited than planned ({n(planned)}).
        </p>
      )}
      <div className="row no-print">
        {over && onPlanFor && (
          <button
            type="button"
            className="btn btn-small"
            disabled={busy}
            onClick={() => onPlanFor(name, count.invited)}
          >
            Plan for {n(count.invited)}
          </button>
        )}
        {onSeat && (
          <button type="button" className="btn btn-small btn-link" onClick={() => onSeat(name)}>
            Seat this function
          </button>
        )}
      </div>
    </div>
  );
}
