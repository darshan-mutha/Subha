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
