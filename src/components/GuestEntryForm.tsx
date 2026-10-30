"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { GuestEntrySchema, newEntryId, type GuestEntry } from "@/lib/guestList";
import { GUEST_GROUP_LABELS, groupChoices, type GuestGroup } from "@/lib/rsvp";
import { fieldErrors, type EventType } from "@/lib/schemas";

interface Props {
  /** The entry to edit, or none to add a new one. */
  entry?: GuestEntry;
  functions: string[];
  eventType: EventType;
  onSave: (entry: GuestEntry) => void;
  onCancel: () => void;
}

/** The error wiring for one field: its message (if any) and the input's aria attributes. */
function fieldErrorWiring(id: string, errors: Record<string, string>) {
  const err = (field: string) =>
    errors[field] ? (
      <p className="field-error" id={`${id}-${field}-err`}>
        {errors[field]}
      </p>
    ) : null;
  const invalid = (field: string) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${id}-${field}-err` : undefined,
  });
  return { err, invalid };
}

/** "Invited to": tick the functions this family is invited to. */
function InvitedTo({
  functions,
  chosen,
  onChosen,
}: {
  functions: string[];
  chosen: string[];
  onChosen: (next: string[]) => void;
}) {
  return (
    <fieldset className="field choice-group">
      <legend>Invited to</legend>
      <p className="hint">Leave all unticked to invite them to every function.</p>
      <div className="choices">
        {functions.map((f) => (
          <label key={f} className="choice">
            <input
              type="checkbox"
              checked={chosen.includes(f)}
              onChange={(e) => onChosen(e.target.checked ? [...chosen, f] : chosen.filter((x) => x !== f))}
            />
            {f}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Add or edit one family or person on the guest list. */
export function GuestEntryForm({ entry, functions, eventType, onSave, onCancel }: Props) {
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(entry?.name ?? "");
  const [people, setPeople] = useState(String(entry?.people ?? 1));
  const [phone, setPhone] = useState(entry?.phone ?? "");
  const [side, setSide] = useState<GuestGroup>(entry?.side ?? "");
  const [chosen, setChosen] = useState<string[]>(entry?.functions ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { err, invalid } = fieldErrorWiring(id, errors);
  const sides = groupChoices(eventType);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = GuestEntrySchema.safeParse({
      id: entry?.id ?? newEntryId(),
      name,
      people,
      phone,
      side,
      functions: chosen.length === functions.length ? [] : chosen,
      invitedAt: entry?.invitedAt ?? "",
      remindedAt: entry?.remindedAt ?? "",
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      requestAnimationFrame(() => nameRef.current?.focus());
      return;
    }
    onSave(parsed.data);
  }

  return (
    <form className="gl-form" onSubmit={submit} noValidate aria-label={entry ? `Edit ${entry.name}` : "Add a guest"}>
      <div className="field">
        <label htmlFor={`${id}-name`}>Name of the family or person</label>
        <input
          ref={nameRef}
          id={`${id}-name`}
          type="text"
          maxLength={80}
          placeholder="e.g. Sharma family"
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...invalid("name")}
        />
        {err("name")}
      </div>
      <div className="field-pair">
        <div className="field">
          <label htmlFor={`${id}-people`}>How many people</label>
          <input
            id={`${id}-people`}
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            {...invalid("people")}
          />
          {err("people")}
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>Phone (optional)</label>
          <input
            id={`${id}-phone`}
            type="tel"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            {...invalid("phone")}
          />
          {err("phone")}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-side`}>Side (optional)</label>
        <select id={`${id}-side`} value={side} onChange={(e) => setSide(sides.find((g) => g === e.target.value) ?? "")}>
          <option value="">Not set</option>
          {sides.map((g) => (
            <option key={g} value={g}>
              {GUEST_GROUP_LABELS[g]}
            </option>
          ))}
        </select>
      </div>
      {functions.length > 1 && <InvitedTo functions={functions} chosen={chosen} onChosen={setChosen} />}
      <div className="row">
        <button type="submit" className="btn btn-primary btn-small">
          {entry ? "Save" : "Add to list"}
        </button>
        <button type="button" className="btn btn-link btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
