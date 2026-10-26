"use client";

import { useId, useState } from "react";
import { ApiError, requestGuestGroups } from "@/lib/client";
import type { GuestGroupIdea } from "@/lib/guestGroups";
import { newEntryId, parseGuestText, type DraftEntry, type GuestEntry } from "@/lib/guestList";
import { GUEST_GROUP_LABELS, groupChoices, type GuestGroup } from "@/lib/rsvp";
import type { EventInput } from "@/lib/schemas";
import { GuestEntryForm } from "./GuestEntryForm";

interface Props {
  input: EventInput;
  functions: string[];
  onAdd: (entries: GuestEntry[]) => void;
  /** Closes the panel; null when the list is empty (nothing to go back to). */
  onCancel: (() => void) | null;
}

type Mode = "choose" | "help" | "paste" | "one";

interface ContactsManager {
  select: (props: string[], options: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]>;
}

function contactsApi(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const c = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
  return c && typeof c.select === "function" ? c : null;
}

/** The ways to add guests: help building the list, paste, phone contacts, one by one. */
export function AddGuests({ input, functions, onAdd, onCancel }: Props) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("choose");
  const [groups, setGroups] = useState<{ groups: GuestGroupIdea[]; reminders: string[]; source: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [side, setSide] = useState<GuestGroup>("");
  const [forGroup, setForGroup] = useState("");
  const [drafts, setDrafts] = useState<DraftEntry[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const contacts = contactsApi();
  const sides = groupChoices(input.eventType);

  async function help() {
    setMode("help");
    if (groups) return;
    setLoading(true);
    setError("");
    try {
      setGroups(await requestGuestGroups({ input, functions }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function startPaste(group?: GuestGroupIdea) {
    setForGroup(group?.name ?? "");
    setSide(group?.side && sides.includes(group.side) ? group.side : "");
    setText("");
    setDrafts(null);
    setSkipped([]);
    setMode("paste");
    requestAnimationFrame(() => document.getElementById(`${id}-paste`)?.focus());
  }

  function read() {
    const result = parseGuestText(text);
    setDrafts(result.entries);
    setSkipped(result.skipped);
  }

  async function pickContacts() {
    if (!contacts) return;
    setError("");
    try {
      const picked = await contacts.select(["name", "tel"], { multiple: true });
      const list = picked
        .map((c) => ({
          name: (c.name?.[0] ?? "").trim().slice(0, 80),
          phone: (c.tel?.[0] ?? "").replace(/[^0-9+\s-]/g, "").slice(0, 20),
          people: 1,
          guessed: false,
        }))
        .filter((c) => c.name);
      if (!list.length) return;
      setForGroup("");
      setDrafts(list);
      setSkipped([]);
      setMode("paste");
    } catch {
      setError("Could not open your contacts. You can paste names instead.");
    }
  }

  function addDrafts() {
    if (!drafts?.length) return;
    onAdd(
      drafts.map((d) => ({
        id: newEntryId(),
        name: d.name,
        people: Math.min(50, Math.max(1, Math.round(d.people) || 1)),
        phone: d.phone,
        side,
        functions: [],
        invitedAt: "",
        remindedAt: "",
      })),
    );
  }

  const back = (
    <button type="button" className="btn btn-link btn-small" onClick={() => setMode("choose")}>
      ← Other ways to add
    </button>
  );

  return (
    <section className="add-guests" aria-labelledby={`${id}-title`}>
      <div className="add-guests-head">
        <h3 id={`${id}-title`}>{mode === "choose" ? "How do you want to add guests?" : "Add guests"}</h3>
        {onCancel && (
          <button type="button" className="btn btn-link btn-small" onClick={onCancel}>
            Close
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {mode === "choose" && (
        <ul className="ways" role="list">
          <li>
            <button type="button" className="way is-ai" onClick={() => void help()}>
              <span className="way-ic" aria-hidden="true">
                ✨
              </span>
              <span>
                <strong>Help me build it</strong>
                <span className="small muted">
                  Shubā lists the groups to think of and about how many from each to reach{" "}
                  {input.guests.toLocaleString("en-IN")}. You fill in names group by group.
                </span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" className="way" onClick={() => startPaste()}>
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
          {contacts && (
            <li>
              <button type="button" className="way" onClick={() => void pickContacts()}>
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
            <button type="button" className="way" onClick={() => setMode("one")}>
              <span className="way-ic" aria-hidden="true">
                ＋
              </span>
              <span>
                <strong>Add one by one</strong>
              </span>
            </button>
          </li>
        </ul>
      )}

      {mode === "one" && (
        <>
          <GuestEntryForm
            functions={functions}
            eventType={input.eventType}
            onSave={(entry) => onAdd([entry])}
            onCancel={() => setMode("choose")}
          />
        </>
      )}

      {mode === "help" && (
        <>
          {back}
          {loading && (
            <p className="loading" role="status">
              <span className="spinner" aria-hidden="true" /> Thinking about who to invite… about 10 seconds.
            </p>
          )}
          {groups && (
            <>
              <p className="small muted" role="status">
                About {input.guests.toLocaleString("en-IN")} people in all. These are rough numbers to help you think;
                change them as you like.
                {groups.source === "standard" && " (Shubā's AI is busy, so these are standard groups.)"}
              </p>
              <ul className="gl-groups" role="list">
                {groups.groups.map((g) => (
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
                      onClick={() => startPaste(g)}
                      aria-label={`Add names for ${g.name}`}
                    >
                      Add names
                    </button>
                  </li>
                ))}
              </ul>
              {groups.reminders.length > 0 && (
                <p className="small muted">
                  <strong>Don&rsquo;t forget:</strong> {groups.reminders.join(" · ")}
                </p>
              )}
            </>
          )}
        </>
      )}

      {mode === "paste" && (
        <>
          {back}
          {!drafts ? (
            <>
              <div className="field">
                <label htmlFor={`${id}-paste`}>
                  {forGroup ? `Names for "${forGroup}"` : "Paste or type names"}, one family or person per line
                </label>
                <textarea
                  id={`${id}-paste`}
                  rows={6}
                  maxLength={20000}
                  placeholder={
                    "Sharma family 4 - 98290 12345\nMeena aunty + Raj uncle\nRohan's office team approx 12\nKapoors (3)"
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <p className="hint">
                  Add a number for how many people, and a phone number if you have it. Your list stays with your plan;
                  it is not sent to the AI.
                </p>
              </div>
              <div className="row">
                <button type="button" className="btn btn-primary btn-small" disabled={!text.trim()} onClick={read}>
                  Read my list
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="small" role="status">
                {drafts.length
                  ? `Found ${drafts.length} ${drafts.length === 1 ? "entry" : "entries"}, ${drafts.reduce((s, d) => s + d.people, 0)} people. Check and fix before adding.`
                  : "No names found. Try one family or person per line."}
                {skipped.length > 0 &&
                  ` Skipped ${skipped.length} line${skipped.length === 1 ? "" : "s"} without a name.`}
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
                          setDrafts(
                            drafts.map((x, j) =>
                              j === i ? { ...x, people: Number(e.target.value), guessed: false } : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="btn-inline"
                        aria-label={`Leave out ${d.name}`}
                        onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="field gl-draft-side">
                <label htmlFor={`${id}-side`}>Side for these (optional)</label>
                <select id={`${id}-side`} value={side} onChange={(e) => setSide(e.target.value as GuestGroup)}>
                  <option value="">Not set</option>
                  {sides.map((g) => (
                    <option key={g} value={g}>
                      {GUEST_GROUP_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={!drafts.length}
                  onClick={addDrafts}
                >
                  Add {drafts.length === 1 ? "this 1" : `these ${drafts.length}`}
                </button>
                <button type="button" className="btn btn-link btn-small" onClick={() => setDrafts(null)}>
                  Edit the text
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
