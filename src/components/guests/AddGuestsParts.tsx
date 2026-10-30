"use client";

import type { RefObject } from "react";
import type { GuestGroupIdea } from "@/lib/guestGroups";
import type { DraftEntry } from "@/lib/guestList";
import { GUEST_GROUP_LABELS, type GuestGroup } from "@/lib/rsvp";
import type { GroupIdeas } from "./useAddGuests";

/** The list of ways to add guests shown first in the Add guests panel. */
export function WaysToAdd({
  guests,
  hasContacts,
  onHelp,
  onPaste,
  onContacts,
  onOne,
}: {
  guests: number;
  hasContacts: boolean;
  onHelp: () => void;
  onPaste: () => void;
  onContacts: () => void;
  onOne: () => void;
}) {
  return (
    <ul className="ways" role="list">
      <li>
        <button type="button" className="way is-ai" onClick={onHelp}>
          <span className="way-ic" aria-hidden="true">
            ✨
          </span>
          <span>
            <strong>Help me build it</strong>
            <span className="small muted">
              Shubā lists the groups to think of and about how many from each to reach {guests.toLocaleString("en-IN")}.
              You fill in names group by group.
            </span>
          </span>
        </button>
      </li>
      <li>
        <button type="button" className="way" onClick={onPaste}>
          <span className="way-ic" aria-hidden="true">
            📋
          </span>
          <span>
            <strong>Paste a list</strong>
            <span className="small muted">
              From WhatsApp, Excel or notes. Shubā sorts it into families, counts and phone numbers.
            </span>
          </span>
        </button>
      </li>
      {hasContacts && (
        <li>
          <button type="button" className="way" onClick={onContacts}>
            <span className="way-ic" aria-hidden="true">
              📱
            </span>
            <span>
              <strong>Pick from my contacts</strong>
              <span className="small muted">Only the people you pick are added.</span>
            </span>
          </button>
        </li>
      )}
      <li>
        <button type="button" className="way" onClick={onOne}>
          <span className="way-ic" aria-hidden="true">
            ＋
          </span>
          <span>
            <strong>Add one by one</strong>
          </span>
        </button>
      </li>
    </ul>
  );
}

/** The AI-suggested guest groups, each with an "Add names" button. */
export function GroupIdeasList({
  guests,
  ideas,
  onAddNames,
}: {
  guests: number;
  ideas: GroupIdeas;
  onAddNames: (group: GuestGroupIdea) => void;
}) {
  return (
    <>
      <p className="small muted" role="status">
        About {guests.toLocaleString("en-IN")} people in all. These are rough numbers to help you think; change them as
        you like.
        {ideas.source === "standard" && " (Shubā's AI is busy, so these are standard groups.)"}
      </p>
      <ul className="gl-groups" role="list">
        {ideas.groups.map((g) => (
          <li key={g.name} className="gl-group">
            <div>
              <strong>
                {g.name} · about {g.about}
              </strong>
              <span className="small muted">{g.who}</span>
            </div>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onAddNames(g)}
              aria-label={`Add names for ${g.name}`}
            >
              Add names
            </button>
          </li>
        ))}
      </ul>
      {ideas.reminders.length > 0 && (
        <p className="small muted">
          <strong>Don&rsquo;t forget:</strong> {ideas.reminders.join(" · ")}
        </p>
      )}
    </>
  );
}

/** The textarea where the host pastes or types names, and the "Read my list" button. */
export function PasteNames({
  id,
  boxRef,
  forGroup,
  text,
  onText,
  onRead,
}: {
  id: string;
  /** Focused when the host chooses to paste a list. */
  boxRef: RefObject<HTMLTextAreaElement | null>;
  forGroup: string;
  text: string;
  onText: (text: string) => void;
  onRead: () => void;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-paste`}>
          {forGroup ? `Names for "${forGroup}"` : "Paste or type names"}, one family or person per line
        </label>
        <textarea
          ref={boxRef}
          id={`${id}-paste`}
          rows={6}
          maxLength={20000}
          placeholder={
            "Sharma family 4 - 98290 12345\nMeena aunty + Raj uncle\nRohan's office team approx 12\nKapoors (3)"
          }
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
        <p className="hint">
          Add a number for how many people, and a phone number if you have it. Your list stays with your plan; it is not
          sent to the AI.
        </p>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary btn-small" disabled={!text.trim()} onClick={onRead}>
          Read my list
        </button>
      </div>
    </>
  );
}

/** The names read from the list, to check counts, pick a side and add them. */
export function DraftsReview({
  id,
  drafts,
  skipped,
  side,
  sides,
  onDrafts,
  onSide,
  onAdd,
  onEditText,
}: {
  id: string;
  drafts: DraftEntry[];
  skipped: string[];
  side: GuestGroup;
  sides: GuestGroup[];
  onDrafts: (drafts: DraftEntry[]) => void;
  onSide: (side: GuestGroup) => void;
  onAdd: () => void;
  onEditText: () => void;
}) {
  return (
    <>
      <p className="small" role="status">
        {drafts.length
          ? `Found ${drafts.length} ${drafts.length === 1 ? "entry" : "entries"}, ${drafts.reduce((s, d) => s + d.people, 0)} people. Check and fix before adding.`
          : "No names found. Try one family or person per line."}
        {skipped.length > 0 && ` Skipped ${skipped.length} line${skipped.length === 1 ? "" : "s"} without a name.`}
      </p>
      {drafts.length > 0 && (
        <ul className="gl-drafts" role="list" aria-label="Names found">
          {drafts.map((d, i) => (
            <li key={`${i}-${d.name}`}>
              <span className="gl-draft-name">
                {d.name}
                {d.phone && <span className="small muted"> · {d.phone}</span>}
                {d.guessed && <span className="small gl-guess"> · count guessed</span>}
              </span>
              <label className="sr-only" htmlFor={`${id}-n-${i}`}>
                People in {d.name}
              </label>
              <input
                id={`${id}-n-${i}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                className="gl-draft-n"
                value={d.people}
                onChange={(e) =>
                  onDrafts(
                    drafts.map((x, j) => (j === i ? { ...x, people: Number(e.target.value), guessed: false } : x)),
                  )
                }
              />
              <button
                type="button"
                className="btn-inline"
                aria-label={`Leave out ${d.name}`}
                onClick={() => onDrafts(drafts.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="field gl-draft-side">
        <label htmlFor={`${id}-side`}>Side for these (optional)</label>
        <select id={`${id}-side`} value={side} onChange={(e) => onSide(e.target.value as GuestGroup)}>
          <option value="">Not set</option>
          {sides.map((g) => (
            <option key={g} value={g}>
              {GUEST_GROUP_LABELS[g]}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary btn-small" disabled={!drafts.length} onClick={onAdd}>
          Add {drafts.length === 1 ? "this 1" : `these ${drafts.length}`}
        </button>
        <button type="button" className="btn btn-link btn-small" onClick={onEditText}>
          Edit the text
        </button>
      </div>
    </>
  );
}
