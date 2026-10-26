"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ApiError, loadGuests, type GuestsState } from "@/lib/client";
import {
  filterLabel,
  guestListCsv,
  inviteFor,
  LIST_FILTERS,
  listRows,
  listSuggestsGuests,
  listSummary,
  MAX_GUEST_ENTRIES,
  reminderFor,
  rowMatches,
  STATUS_LABELS,
  type GuestEntry,
  type GuestList as Entries,
  type ListFilter,
  type ListRow,
} from "@/lib/guestList";
import { inviteFacts, inviteMessage, type Invite } from "@/lib/invite";
import { GUEST_GROUP_LABELS } from "@/lib/rsvp";
import type { EventInput } from "@/lib/schemas";
import { AddGuests } from "./AddGuests";
import { GuestEntryForm } from "./GuestEntryForm";
import { vendorWhatsApp } from "./VendorDeal";

const POLL_MS = 30_000;

interface Props {
  entries: Entries;
  /** Shared plan id: replies from the guest link are matched to the list. */
  planId: string | null;
  active: boolean;
  input: EventInput;
  title: string;
  invite: Invite | null;
  /** Function names in this plan, for "invited to". */
  functions: string[];
  today: string;
  busy: boolean;
  onChange: (next: Entries) => void;
  /** Re-plans for the list's head count, with What changed and Undo. */
  onUseGuests: (guests: number) => void;
  /** Opens the Replies part (to turn on the reply link). */
  onShowReplies: () => void;
}

const pct = (n: number, of: number) => `${of ? Math.min(100, (n / of) * 100) : 0}%`;

function niceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** The host's guest list: counts, filters, each family with its status, invites and reminders. */
export function GuestList({
  entries,
  planId,
  active,
  input,
  title,
  invite,
  functions,
  today,
  busy,
  onChange,
  onUseGuests,
  onShowReplies,
}: Props) {
  const id = useId();
  const [state, setState] = useState<GuestsState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState("");
  const [confirming, setConfirming] = useState("");
  const [announce, setAnnounce] = useState("");

  const refresh = useCallback((): Promise<void> => {
    if (!planId) return Promise.resolve();
    return loadGuests(planId).then(
      (next) => {
        setState(next);
        setLoadError("");
      },
      (e: unknown) => setLoadError(e instanceof ApiError ? e.message : "Could not load guest replies."),
    );
  }, [planId]);

  useEffect(() => {
    if (!planId || !active) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [planId, active, refresh]);

  const replies = useMemo(() => state?.replies ?? [], [state]);
  const rows = useMemo(() => listRows(entries, replies, today), [entries, replies, today]);
  const s = useMemo(() => listSummary(rows), [rows]);
  const shown = rows.filter((r) => rowMatches(r, filter));
  const suggestion = listSuggestsGuests(s.people, input.guests, s.families, s.notInvited === 0);
  const link = state?.link?.open ? `${window.location.origin}/r/${state.link.token}` : "";
  const base = {
    title,
    link,
    when: niceDate(input.date),
    inviteText: invite ? inviteMessage(invite.wording, inviteFacts(input, invite.details)) : "",
  };

  const update = (entryId: string, change: Partial<GuestEntry>) =>
    onChange(entries.map((e) => (e.id === entryId ? { ...e, ...change } : e)));

  function addEntries(added: GuestEntry[]) {
    const room = MAX_GUEST_ENTRIES - entries.length;
    const next = added.slice(0, room);
    onChange([...entries, ...next]);
    setAdding(false);
    setFilter("all");
    setAnnounce(
      `${next.length} ${next.length === 1 ? "entry" : "entries"} added.${
        added.length > room ? ` The list holds up to ${MAX_GUEST_ENTRIES}.` : ""
      }`,
    );
  }

  const filters: ListFilter[] = [
    ...LIST_FILTERS.filter((f) => f === "all" || rows.some((r) => rowMatches(r, f))),
    ...(s.sides.length > 1 ? s.sides.map((side) => `side:${side}` as ListFilter) : []),
  ];

  if (entries.length === 0 || adding) {
    return (
      <>
        <p className="sr-only" role="status">
          {announce}
        </p>
        {entries.length === 0 && (
          <p className="muted">
            Make your own list of families and friends, then send each one the invitation on WhatsApp. Shubā tracks who
            is invited and who has replied.
          </p>
        )}
        <AddGuests
          input={input}
          functions={functions}
          onAdd={addEntries}
          onCancel={entries.length ? () => setAdding(false) : null}
        />
      </>
    );
  }

  const tiles = [
    { n: s.families, l: "Families" },
    { n: s.people, l: "People" },
    { n: s.invited, l: "Invited", tone: s.invited ? "good" : "" },
    { n: s.noReply, l: "No reply", tone: s.noReply ? "warn" : "" },
  ];

  return (
    <>
      <p className="sr-only" role="status">
        {announce}
      </p>
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
        aria-label={`${s.comingPeople} coming, ${s.maybePeople} maybe, ${s.people} listed, of ${input.guests} planned`}
      >
        <span className="vs-bar-booked" style={{ width: pct(s.comingPeople, input.guests) }} />
        <span className="vs-bar-quotes" style={{ width: pct(s.maybePeople, input.guests) }} />
        <span
          className="gl-bar-listed"
          style={{ width: pct(Math.max(0, s.people - s.comingPeople - s.maybePeople), input.guests) }}
        />
      </div>
      <p className="small muted gl-target">
        {s.people.toLocaleString("en-IN")} of {input.guests.toLocaleString("en-IN")} planned
        {s.people <= input.guests ? ` · ${input.guests - s.people} seats left` : ` · ${s.people - input.guests} over`}
        {planId && ` · ${s.comingPeople} coming, ${s.maybePeople} maybe so far`}
      </p>
      {suggestion && (
        <div className="row">
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => onUseGuests(suggestion)}>
            Update the plan to {suggestion} guests
          </button>
        </div>
      )}

      {s.remind > 0 && (
        <p className="gl-remind">
          {s.remind} {s.remind === 1 ? "family hasn't" : "families haven't"} replied in a week.{" "}
          <button type="button" className="btn-inline" onClick={() => setFilter("remind")}>
            Send a reminder
          </button>{" "}
          — one tap each on WhatsApp.
        </p>
      )}
      {!planId ? (
        <p className="hint">
          Tip: get the guest link (Replies) so invitations carry a reply link and answers show up here.
        </p>
      ) : (
        !link && (
          <p className="hint">
            Turn on guest replies so invitations carry a reply link.{" "}
            <button type="button" className="btn-inline" onClick={onShowReplies}>
              Go to Replies
            </button>
          </p>
        )
      )}
      {loadError && <p className="form-error">{loadError}</p>}

      <div className="vs-filters" role="group" aria-label="Filter guests">
        {filters.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {filterLabel(f)} {rows.filter((r) => rowMatches(r, f)).length}
          </button>
        ))}
      </div>

      <ul className="gl-list" role="list" aria-label="Guest list">
        {shown.map((row) =>
          editing === row.entry.id ? (
            <li key={row.entry.id} className="gl-row is-editing">
              <GuestEntryForm
                entry={row.entry}
                functions={functions}
                eventType={input.eventType}
                onSave={(next) => {
                  update(row.entry.id, next);
                  setEditing("");
                }}
                onCancel={() => setEditing("")}
              />
            </li>
          ) : (
            <GuestRow
              key={row.entry.id}
              row={row}
              base={base}
              confirming={confirming === row.entry.id}
              onInvited={() => update(row.entry.id, { invitedAt: today })}
              onReminded={() => update(row.entry.id, { remindedAt: today })}
              onEdit={() => setEditing(row.entry.id)}
              onAskRemove={() => setConfirming(row.entry.id)}
              onKeep={() => setConfirming("")}
              onRemove={() => {
                setConfirming("");
                onChange(entries.filter((e) => e.id !== row.entry.id));
                setAnnounce(`${row.entry.name} removed from the list`);
              }}
            />
          ),
        )}
      </ul>
      {shown.length === 0 && (
        <p className="muted">
          No one here right now.{" "}
          <button type="button" className="btn-inline" onClick={() => setFilter("all")}>
            Show everyone
          </button>
        </p>
      )}

      <div className="row gl-actions">
        <button type="button" className="btn btn-small" onClick={() => setAdding(true)}>
          <span aria-hidden="true">+ </span>Add guests
        </button>
        <a
          className="btn btn-small btn-link"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(guestListCsv(rows))}`}
          download="guest-list.csv"
          id={`${id}-csv`}
        >
          Download list
        </a>
        {planId && (
          <button type="button" className="btn btn-small btn-link" onClick={() => void refresh()}>
            Refresh replies
          </button>
        )}
      </div>
    </>
  );
}

function GuestRow({
  row,
  base,
  confirming,
  onInvited,
  onReminded,
  onEdit,
  onAskRemove,
  onKeep,
  onRemove,
}: {
  row: ListRow;
  base: { title: string; link: string; when: string; inviteText: string };
  confirming: boolean;
  onInvited: () => void;
  onReminded: () => void;
  onEdit: () => void;
  onAskRemove: () => void;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const { entry, reply, status } = row;
  const coming = reply && reply.coming !== "no" ? reply.adults + reply.kids : 0;
  const tag =
    status === "coming"
      ? `Coming ${coming}`
      : status === "maybe"
        ? `Maybe ${coming}`
        : status === "invited"
          ? STATUS_LABELS.invited
          : STATUS_LABELS[status];
  return (
    <li className="gl-row">
      <div className="gl-main">
        <p className="gl-name">{entry.name}</p>
        <p className="small muted">
          {[
            `${entry.people} ${entry.people === 1 ? "person" : "people"}`,
            entry.side && GUEST_GROUP_LABELS[entry.side],
            entry.phone,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {entry.functions.length > 0 && (
          <p className="gl-fns">
            <span className="sr-only">Invited to: </span>
            {entry.functions.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </p>
        )}
        <p className="gl-row-actions no-print">
          <button type="button" className="btn-inline" onClick={onEdit} aria-label={`Edit ${entry.name}`}>
            Edit
          </button>
          {confirming ? (
            <span role="group" aria-label={`Remove ${entry.name}?`}>
              {" "}
              <button type="button" className="btn-inline is-danger" onClick={onRemove}>
                Yes, remove
              </button>{" "}
              <button type="button" className="btn-inline" onClick={onKeep}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="btn-inline" onClick={onAskRemove} aria-label={`Remove ${entry.name}`}>
              Remove
            </button>
          )}
        </p>
      </div>
      <div className="gl-side">
        {status === "not-invited" ? (
          <a
            className="btn btn-primary btn-small"
            href={vendorWhatsApp(entry.phone, inviteFor(entry, base))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onInvited}
          >
            Send invite<span className="sr-only"> to {entry.name} on WhatsApp (opens WhatsApp)</span>
          </a>
        ) : (
          <span className={`vs-tag gl-status is-${status}`}>{tag}</span>
        )}
        {row.remind && (
          <a
            className="btn btn-small"
            href={vendorWhatsApp(entry.phone, reminderFor(entry, base))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onReminded}
          >
            Remind<span className="sr-only"> {entry.name} on WhatsApp (opens WhatsApp)</span>
          </a>
        )}
      </div>
    </li>
  );
}
