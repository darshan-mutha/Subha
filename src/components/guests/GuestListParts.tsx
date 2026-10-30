"use client";

import { filterLabel, rowMatches, type ListFilter, type ListRow, type ListSummary } from "@/lib/guestList";

const pct = (n: number, of: number) => `${of ? Math.min(100, (n / of) * 100) : 0}%`;

/** Count tiles, the progress bar and the "of planned" line at the top of the guest list. */
export function ListCounts({
  s,
  guests,
  shared,
  suggestion,
  busy,
  onUseGuests,
}: {
  s: ListSummary;
  guests: number;
  /** True when the plan is shared, so reply counts are live. */
  shared: boolean;
  suggestion: number | null;
  busy: boolean;
  onUseGuests: (guests: number) => void;
}) {
  const tiles = [
    { n: s.families, l: "Families" },
    { n: s.people, l: "People" },
    { n: s.invited, l: "Invited", tone: s.invited ? "good" : "" },
    { n: s.noReply, l: "No reply", tone: s.noReply ? "warn" : "" },
  ];
  return (
    <>
      <div className="gl-tiles">
        {tiles.map((t) => (
          <div key={t.l} className={`gl-tile${t.tone ? ` is-${t.tone}` : ""}`}>
            <span className="vs-n">{t.n}</span>
            <span className="vs-l">{t.l}</span>
          </div>
        ))}
      </div>
      <div
        className="vs-bar gl-bar"
        role="img"
        aria-label={`${s.comingPeople} coming, ${s.maybePeople} maybe, ${s.people} listed, of ${guests} planned`}
      >
        <span className="vs-bar-booked" style={{ width: pct(s.comingPeople, guests) }} />
        <span className="vs-bar-quotes" style={{ width: pct(s.maybePeople, guests) }} />
        <span
          className="gl-bar-listed"
          style={{ width: pct(Math.max(0, s.people - s.comingPeople - s.maybePeople), guests) }}
        />
      </div>
      <p className="small muted gl-target">
        {s.people.toLocaleString("en-IN")} of {guests.toLocaleString("en-IN")} planned
        {s.people <= guests ? ` · ${guests - s.people} seats left` : ` · ${s.people - guests} over`}
        {shared && ` · ${s.comingPeople} coming, ${s.maybePeople} maybe so far`}
      </p>
      {suggestion && (
        <div className="row">
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => onUseGuests(suggestion)}>
            Update the plan to {suggestion} guests
          </button>
        </div>
      )}
    </>
  );
}

/** The reminder nudge and the tips about turning on the reply link. */
export function ListNudges({
  remind,
  shared,
  hasLink,
  onRemindFilter,
  onShowReplies,
}: {
  remind: number;
  shared: boolean;
  hasLink: boolean;
  onRemindFilter: () => void;
  onShowReplies: () => void;
}) {
  return (
    <>
      {remind > 0 && (
        <p className="gl-remind">
          {remind} {remind === 1 ? "family hasn't" : "families haven't"} replied in a week.{" "}
          <button type="button" className="btn-inline" onClick={onRemindFilter}>
            Send a reminder
          </button>{" "}
          — one tap each on WhatsApp.
        </p>
      )}
      {!shared ? (
        <p className="hint">
          Tip: get the guest link (Replies) so invitations carry a reply link and answers show up here.
        </p>
      ) : (
        !hasLink && (
          <p className="hint">
            Turn on guest replies so invitations carry a reply link.{" "}
            <button type="button" className="btn-inline" onClick={onShowReplies}>
              Go to Replies
            </button>
          </p>
        )
      )}
    </>
  );
}

/** The filter chips above the guest list, each with its count. */
export function ListFilters({
  filters,
  rows,
  filter,
  onFilter,
}: {
  filters: ListFilter[];
  rows: ListRow[];
  filter: ListFilter;
  onFilter: (f: ListFilter) => void;
}) {
  return (
    <div className="vs-filters" role="group" aria-label="Filter guests">
      {filters.map((f) => (
        <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => onFilter(f)}>
          {filterLabel(f)} {rows.filter((r) => rowMatches(r, f)).length}
        </button>
      ))}
    </div>
  );
}

/** Add guests, Download list and Refresh replies under the guest list. */
export function ListActions({
  id,
  csv,
  shared,
  onAdd,
  onRefresh,
}: {
  id: string;
  csv: string;
  shared: boolean;
  onAdd: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="row gl-actions">
      <button type="button" className="btn btn-small" onClick={onAdd}>
        <span aria-hidden="true">+ </span>Add guests
      </button>
      <a
        className="btn btn-small btn-link"
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
        download="guest-list.csv"
        id={`${id}-csv`}
      >
        Download list
      </a>
      {shared && (
        <button type="button" className="btn btn-small btn-link" onClick={onRefresh}>
          Refresh replies
        </button>
      )}
    </div>
  );
}
