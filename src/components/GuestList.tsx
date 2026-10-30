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
import { longDate } from "@/lib/dates";
import type { EventInput } from "@/lib/schemas";
import { AddGuests } from "./AddGuests";
import { GuestRows, type MessageBase } from "./guests/GuestRow";
import { ListActions, ListCounts, ListFilters, ListNudges } from "./guests/GuestListParts";
import type { Replies } from "./useReplies";

interface Props {
  entries: Entries;
  /** Shared plan id, or null while the plan is only on this device. */
  planId: string | null;
  /** Replies from the guest link, matched to the list. */
  replies: Replies;
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

/** Guest list state: replies matched to the list, filter, what is being added, edited or removed. */
function useGuestListModel(props: Props) {
  const { entries, input, title, invite, today, onChange } = props;
  const { replies, state, error: loadError, refresh } = props.replies;
  const [filter, setFilter] = useState<ListFilter>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState("");
  const [confirming, setConfirming] = useState("");
  const [announce, setAnnounce] = useState("");

  const rows = useMemo(() => listRows(entries, replies, today), [entries, replies, today]);
  const s = useMemo(() => listSummary(rows), [rows]);
  const link = state?.link?.open ? `${window.location.origin}/r/${state.link.token}` : "";
  const base: MessageBase = {
    title,
    link,
    when: longDate(input.date),
    inviteText: invite ? inviteMessage(invite.wording, inviteFacts(input, invite.details)) : "",
  };
  const filters: ListFilter[] = [
    ...LIST_FILTERS.filter((f) => f === "all" || rows.some((r) => rowMatches(r, f))),
    ...(s.sides.length > 1 ? s.sides.map((side) => `side:${side}` as ListFilter) : []),
  ];

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

  function remove(entry: GuestEntry) {
    onChange(entries.filter((e) => e.id !== entry.id));
    setAnnounce(`${entry.name} removed from the list`);
  }

  return {
    rows,
    s,
    link,
    base,
    filters,
    filter,
    setFilter,
    adding,
    setAdding,
    editing,
    setEditing,
    confirming,
    setConfirming,
    announce,
    loadError,
    refresh,
    update,
    addEntries,
    remove,
  };
}

/** The host's guest list: counts, filters, each family with its status, invites and reminders. */
export function GuestList(props: Props) {
  const { entries, planId, input, functions, today, busy } = props;
  const id = useId();
  const m = useGuestListModel(props);
  const shown = m.rows.filter((r) => rowMatches(r, m.filter));
  const suggestion = listSuggestsGuests(m.s.people, input.guests, m.s.families, m.s.notInvited === 0);

  const status = (
    <p className="sr-only" role="status">
      {m.announce}
    </p>
  );

  if (entries.length === 0 || m.adding) {
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
          onAdd={m.addEntries}
          onCancel={entries.length ? () => m.setAdding(false) : null}
        />
      </>
    );
  }

  return (
    <>
      {status}
      <ListCounts
        s={m.s}
        guests={input.guests}
        shared={Boolean(planId)}
        suggestion={suggestion}
        busy={busy}
        onUseGuests={props.onUseGuests}
      />
      <ListNudges
        remind={m.s.remind}
        shared={Boolean(planId)}
        hasLink={Boolean(m.link)}
        onRemindFilter={() => m.setFilter("remind")}
        onShowReplies={props.onShowReplies}
      />
      {m.loadError && (
        <p className="form-error" role="alert">
          {m.loadError}
        </p>
      )}

      <ListFilters filters={m.filters} rows={m.rows} filter={m.filter} onFilter={m.setFilter} />

      <GuestRows
        rows={shown}
        base={m.base}
        functions={functions}
        eventType={input.eventType}
        editing={m.editing}
        confirming={m.confirming}
        onEditing={m.setEditing}
        onConfirming={m.setConfirming}
        onUpdate={m.update}
        onRemove={m.remove}
        today={today}
      />
      {shown.length === 0 && (
        <p className="muted">
          No one here right now.{" "}
          <button type="button" className="btn-inline" onClick={() => m.setFilter("all")}>
            Show everyone
          </button>
        </p>
      )}

      <ListActions
        id={id}
        csv={guestListCsv(m.rows)}
        shared={Boolean(planId)}
        onAdd={() => m.setAdding(true)}
        onRefresh={() => void m.refresh()}
      />
    </>
  );
}
