"use client";

import { inviteFor, reminderFor, STATUS_LABELS, type GuestEntry, type ListRow } from "@/lib/guestList";
import { GUEST_GROUP_LABELS } from "@/lib/rsvp";
import type { EventInput } from "@/lib/schemas";
import { GuestEntryForm } from "../GuestEntryForm";
import { vendorWhatsApp } from "../VendorDeal";

/** The shared message details used to write each family's invite and reminder. */
export interface MessageBase {
  title: string;
  link: string;
  when: string;
  inviteText: string;
}

/** The tag for a family that has been invited: its reply status and how many are coming. */
function statusTag({ reply, status }: ListRow): string {
  const coming = reply && reply.coming !== "no" ? reply.adults + reply.kids : 0;
  if (status === "coming") return `Coming ${coming}`;
  if (status === "maybe") return `Maybe ${coming}`;
  return STATUS_LABELS[status];
}

/** A family's name, head count, side, phone, functions, and the Edit/Remove buttons. */
function GuestDetails({
  entry,
  confirming,
  onEdit,
  onAskRemove,
  onKeep,
  onRemove,
}: {
  entry: GuestEntry;
  confirming: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
  onKeep: () => void;
  onRemove: () => void;
}) {
  return (
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
  );
}

/** The family's invite button or reply status, and a reminder when one is due. */
function GuestSide({
  row,
  base,
  onInvited,
  onReminded,
}: {
  row: ListRow;
  base: MessageBase;
  onInvited: () => void;
  onReminded: () => void;
}) {
  const { entry, status } = row;
  return (
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
        <span className={`vs-tag gl-status is-${status}`}>{statusTag(row)}</span>
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
  );
}

/** One family on the guest list: details, Edit/Remove, and its invite or status. */
export function GuestRow({
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
  base: MessageBase;
  confirming: boolean;
  onInvited: () => void;
  onReminded: () => void;
  onEdit: () => void;
  onAskRemove: () => void;
  onKeep: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="gl-row">
      <GuestDetails
        entry={row.entry}
        confirming={confirming}
        onEdit={onEdit}
        onAskRemove={onAskRemove}
        onKeep={onKeep}
        onRemove={onRemove}
      />
      <GuestSide row={row} base={base} onInvited={onInvited} onReminded={onReminded} />
    </li>
  );
}

/** The guest list rows: each family, or its edit form while it is being edited. */
export function GuestRows({
  rows,
  base,
  functions,
  eventType,
  editing,
  confirming,
  today,
  onEditing,
  onConfirming,
  onUpdate,
  onRemove,
}: {
  rows: ListRow[];
  base: MessageBase;
  functions: string[];
  eventType: EventInput["eventType"];
  /** Id of the entry being edited, or "". */
  editing: string;
  /** Id of the entry asking "Remove?", or "". */
  confirming: string;
  today: string;
  onEditing: (entryId: string) => void;
  onConfirming: (entryId: string) => void;
  onUpdate: (entryId: string, change: Partial<GuestEntry>) => void;
  onRemove: (entry: GuestEntry) => void;
}) {
  return (
    <ul className="gl-list" role="list" aria-label="Guest list">
      {rows.map((row) =>
        editing === row.entry.id ? (
          <li key={row.entry.id} className="gl-row is-editing">
            <GuestEntryForm
              entry={row.entry}
              functions={functions}
              eventType={eventType}
              onSave={(next) => {
                onUpdate(row.entry.id, next);
                onEditing("");
              }}
              onCancel={() => onEditing("")}
            />
          </li>
        ) : (
          <GuestRow
            key={row.entry.id}
            row={row}
            base={base}
            confirming={confirming === row.entry.id}
            onInvited={() => onUpdate(row.entry.id, { invitedAt: today })}
            onReminded={() => onUpdate(row.entry.id, { remindedAt: today })}
            onEdit={() => onEditing(row.entry.id)}
            onAskRemove={() => onConfirming(row.entry.id)}
            onKeep={() => onConfirming("")}
            onRemove={() => {
              onConfirming("");
              onRemove(row.entry);
            }}
          />
        ),
      )}
    </ul>
  );
}
