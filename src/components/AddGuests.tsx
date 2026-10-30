"use client";

import { useId } from "react";
import type { GuestEntry } from "@/lib/guestList";
import { groupChoices } from "@/lib/rsvp";
import type { EventInput } from "@/lib/schemas";
import { GuestEntryForm } from "./GuestEntryForm";
import { DraftsReview, GroupIdeasList, PasteNames, WaysToAdd } from "./guests/AddGuestsParts";
import { useAddGuests } from "./guests/useAddGuests";

interface Props {
  input: EventInput;
  functions: string[];
  onAdd: (entries: GuestEntry[]) => void;
  /** Closes the panel; null when the list is empty (nothing to go back to). */
  onCancel: (() => void) | null;
}

/** The ways to add guests: help building the list, paste, phone contacts, one by one. */
export function AddGuests({ input, functions, onAdd, onCancel }: Props) {
  const id = useId();
  const sides = groupChoices(input.eventType);
  const a = useAddGuests({ id, input, functions, sides, onAdd });

  const back = (
    <button type="button" className="btn btn-link btn-small" onClick={() => a.setMode("choose")}>
      ← Other ways to add
    </button>
  );

  return (
    <section className="add-guests" aria-labelledby={`${id}-title`}>
      <div className="add-guests-head">
        <h3 id={`${id}-title`}>{a.mode === "choose" ? "How do you want to add guests?" : "Add guests"}</h3>
        {onCancel && (
          <button type="button" className="btn btn-link btn-small" onClick={onCancel}>
            Close
          </button>
        )}
      </div>
      {a.error && (
        <p className="form-error" role="alert">
          {a.error}
        </p>
      )}

      {a.mode === "choose" && (
        <WaysToAdd
          guests={input.guests}
          hasContacts={a.hasContacts}
          onHelp={() => void a.help()}
          onPaste={() => a.startPaste()}
          onContacts={() => void a.pickContacts()}
          onOne={() => a.setMode("one")}
        />
      )}

      {a.mode === "one" && (
        <GuestEntryForm
          functions={functions}
          eventType={input.eventType}
          onSave={(entry) => onAdd([entry])}
          onCancel={() => a.setMode("choose")}
        />
      )}

      {a.mode === "help" && (
        <>
          {back}
          {a.loading && (
            <p className="loading" role="status">
              <span className="spinner" aria-hidden="true" /> Thinking about who to invite… about 10 seconds.
            </p>
          )}
          {a.groups && <GroupIdeasList guests={input.guests} ideas={a.groups} onAddNames={a.startPaste} />}
        </>
      )}

      {a.mode === "paste" && (
        <>
          {back}
          {!a.drafts ? (
            <PasteNames id={id} forGroup={a.forGroup} text={a.text} onText={a.setText} onRead={a.read} />
          ) : (
            <DraftsReview
              id={id}
              drafts={a.drafts}
              skipped={a.skipped}
              side={a.side}
              sides={sides}
              onDrafts={a.setDrafts}
              onSide={a.setSide}
              onAdd={a.addDrafts}
              onEditText={() => a.setDrafts(null)}
            />
          )}
        </>
      )}
    </section>
  );
}
