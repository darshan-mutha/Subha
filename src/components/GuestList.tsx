"use client";

import { useId, useMemo, useState } from "react";
import {
  guestListCsv,
  LIST_FILTERS,
  listRows,
  listSuggestsGuests,
  listSummary,
  MAX_GUEST_ENTRIES,
  rowMatches,
  type GuestEntry,
  type GuestList as Entries,
  type ListFilter,
} from "@/lib/guestList";
import { inviteFacts, inviteMessage, type Invite } from "@/lib/invite";
import type { EventInput } from "@/lib/schemas";
import { AddGuests } from "./AddGuests";
import { GuestRows, type MessageBase } from "./guests/GuestRow";
import { ListActions, ListCounts, ListFilters, ListNudges } from "./guests/GuestListParts";
import { useGuestsState } from "./guests/useGuestsState";

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

function niceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** The host's guest list: counts, filters, each family with its status, invites and reminders. */
export function GuestList(props: Props) {
  const { entries, planId, active, input, title, invite, functions, today, busy, onChange } = props;
  const id = useId();
  const { state, error: loadError, refresh } = useGuestsState(planId, active);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState("");
  const [confirming, setConfirming] = useState("");
  const [announce, setAnnounce] = useState("");

  const replies = useMemo(() => state?.replies ?? [], [state]);
  const rows = useMemo(() => listRows(entries, replies, today), [entries, replies, today]);
  const s = useMemo(() => listSummary(rows), [rows]);
  const shown = rows.filter((r) => rowMatches(r, filter));
  const suggestion = listSuggestsGuests(s.people, input.guests, s.families, s.notInvited === 0);
  const link = state?.link?.open ? `${window.location.origin}/r/${state.link.token}` : "";
  const base: MessageBase = {
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

  const status = (
    <p className="sr-only" role="status">
      {announce}
    </p>
  );

  if (entries.length === 0 || adding) {
    return (
      <>
        {status}
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

  return (
    <>
      {status}
      <ListCounts
        s={s}
        guests={input.guests}
        shared={Boolean(planId)}
        suggestion={suggestion}
        busy={busy}
        onUseGuests={props.onUseGuests}
      />
      <ListNudges
        remind={s.remind}
        shared={Boolean(planId)}
        hasLink={Boolean(link)}
        onRemindFilter={() => setFilter("remind")}
        onShowReplies={props.onShowReplies}
      />
      {loadError && <p className="form-error">{loadError}</p>}

      <ListFilters filters={filters} rows={rows} filter={filter} onFilter={setFilter} />

      <GuestRows
        rows={shown}
        base={base}
        functions={functions}
        eventType={input.eventType}
        editing={editing}
        confirming={confirming}
        onEditing={setEditing}
        onConfirming={setConfirming}
        onUpdate={update}
        onRemove={(entry) => {
          onChange(entries.filter((e) => e.id !== entry.id));
          setAnnounce(`${entry.name} removed from the list`);
        }}
        today={today}
      />
      {shown.length === 0 && (
        <p className="muted">
          No one here right now.{" "}
          <button type="button" className="btn-inline" onClick={() => setFilter("all")}>
            Show everyone
          </button>
        </p>
      )}

      <ListActions
        id={id}
        csv={guestListCsv(rows)}
        shared={Boolean(planId)}
        onAdd={() => setAdding(true)}
        onRefresh={() => void refresh()}
      />
    </>
  );
}
