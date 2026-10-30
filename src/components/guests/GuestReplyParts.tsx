"use client";

import type { FormEvent, ReactNode, RefObject } from "react";
import {
  COMING,
  GUEST_FOOD_LABELS,
  GUEST_GROUP_LABELS,
  GUEST_REPLY_NEED_LABELS,
  GUEST_REPLY_NEEDS,
  MAX_PARTY,
  type Coming,
  type GuestEvent,
} from "@/lib/rsvp";
import { fullDate } from "@/lib/dates";
import { PetalMark } from "../Brand";
import type { ReplyForm } from "./useGuestReply";

const COMING_CHOICES: Record<Coming, string> = { yes: "Yes, we're coming", maybe: "Maybe", no: "Sorry, can't come" };

type SetField = <K extends keyof ReplyForm>(key: K, value: ReplyForm[K]) => void;

interface FieldHelpers {
  fieldProps: (name: string) => { "aria-invalid": true | undefined; "aria-describedby": string | undefined };
  fieldError: (name: string) => ReactNode;
}

function fieldHelpers(id: string, errors: Record<string, string>): FieldHelpers {
  return {
    fieldProps: (name) => ({
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${id}-${name}-err` : undefined,
    }),
    fieldError: (name) =>
      errors[name] ? (
        <p className="field-error" id={`${id}-${name}-err`}>
          {errors[name]}
        </p>
      ) : null,
  };
}

/** The invitation card at the top of the guest's reply page. */
export function InviteCard({ event }: { event: GuestEvent }) {
  return (
    <header className="card guest-invite">
      <PetalMark size={56} filled={2} />
      <p className="eyebrow">{event.title}</p>
      <h1>{event.heading}</h1>
      <p>{event.message}</p>
      <ul className="facts" aria-label="When and where">
        <li>{fullDate(event.date)}</li>
        {event.time && <li>{event.time}</li>}
        <li>{event.venue}</li>
      </ul>
      {event.closing && <p className="muted">{event.closing}</p>}
    </header>
  );
}

/** Shown after the guest has replied: thanks, their answer, and a way to change it. */
export function ReplyThanks({
  id,
  name,
  sentence,
  open,
  headingRef,
  onChange,
}: {
  id: string;
  name: string;
  sentence: string;
  open: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChange: () => void;
}) {
  return (
    <section className="card guest-thanks" aria-labelledby={`${id}-thanks`}>
      <h2 id={`${id}-thanks`} ref={headingRef} tabIndex={-1} className="section-title">
        Thank you, {name}!
      </h2>
      <p>
        We&rsquo;ve told the hosts. <strong>{sentence}</strong>
      </p>
      {open ? (
        <button type="button" className="btn" onClick={onChange}>
          Change my reply
        </button>
      ) : (
        <p className="muted small">The hosts are no longer taking changes.</p>
      )}
    </section>
  );
}

/** Party size, food and needs: asked only when the guest may be coming. */
function GoingFields({
  id,
  form,
  set,
  foods,
  f,
}: {
  id: string;
  form: ReplyForm;
  set: SetField;
  foods: GuestEvent["foods"];
  f: FieldHelpers;
}) {
  return (
    <>
      <div className="field-pair">
        <div className="field">
          <label htmlFor={`${id}-adults`}>Adults</label>
          <input
            id={`${id}-adults`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_PARTY}
            value={form.adults}
            onChange={(e) => set("adults", e.target.value)}
            {...f.fieldProps("adults")}
          />
          {f.fieldError("adults")}
        </div>
        <div className="field">
          <label htmlFor={`${id}-kids`}>Children</label>
          <input
            id={`${id}-kids`}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_PARTY}
            value={form.kids}
            onChange={(e) => set("kids", e.target.value)}
            {...f.fieldProps("kids")}
          />
          {f.fieldError("kids")}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${id}-food`}>Food</label>
        <select id={`${id}-food`} value={form.food} onChange={(e) => set("food", e.target.value as ReplyForm["food"])}>
          {foods.map((food) => (
            <option key={food} value={food}>
              {GUEST_FOOD_LABELS[food]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="field choice-group">
        <legend>Anything the hosts should know? (optional)</legend>
        <div className="choices choices-col">
          {GUEST_REPLY_NEEDS.map((n) => (
            <label key={n} className="choice">
              <input
                type="checkbox"
                checked={form.needs.includes(n)}
                onChange={(e) =>
                  set("needs", e.target.checked ? [...form.needs, n] : form.needs.filter((x) => x !== n))
                }
              />
              {GUEST_REPLY_NEED_LABELS[n]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** Group, note and phone: the optional details at the end of the reply form. */
function MoreFields({
  id,
  form,
  set,
  groups,
  f,
}: {
  id: string;
  form: ReplyForm;
  set: SetField;
  groups: GuestEvent["groups"];
  f: FieldHelpers;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-group`}>You are from (optional)</label>
        <select
          id={`${id}-group`}
          value={form.group}
          onChange={(e) => set("group", e.target.value as ReplyForm["group"])}
        >
          <option value="">Choose…</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {GUEST_GROUP_LABELS[g]}
            </option>
          ))}
        </select>
        <p className="hint">Helps the hosts seat families and friends together.</p>
      </div>

      <div className="field">
        <label htmlFor={`${id}-note`}>Message or note (optional)</label>
        <textarea
          id={`${id}-note`}
          rows={2}
          maxLength={200}
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          {...f.fieldProps("note")}
        />
        {f.fieldError("note")}
      </div>

      <div className="field">
        <label htmlFor={`${id}-phone`}>Phone (optional)</label>
        <input
          id={`${id}-phone`}
          type="tel"
          autoComplete="tel"
          maxLength={20}
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          {...f.fieldProps("phone")}
        />
        <p className="hint">Only the hosts see it, so they can reach you about the event.</p>
        {f.fieldError("phone")}
      </div>
    </>
  );
}

/** The guest's reply form: name, coming, party, food, needs and optional details. */
export function ReplyFormCard({
  id,
  event,
  form,
  set,
  errors,
  error,
  errorRef,
  busy,
  changing,
  onSubmit,
  onCancel,
}: {
  id: string;
  event: GuestEvent;
  form: ReplyForm;
  set: SetField;
  errors: Record<string, string>;
  error: string;
  errorRef: RefObject<HTMLParagraphElement | null>;
  busy: boolean;
  /** True when the guest is changing a reply they already sent. */
  changing: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const f = fieldHelpers(id, errors);
  return (
    <section className="card" aria-labelledby={`${id}-form`}>
      <h2 id={`${id}-form`} className="section-title">
        {changing ? "Change your reply" : "Will you join us?"}
      </h2>
      {error && (
        <p className="form-error" role="alert" ref={errorRef} tabIndex={-1}>
          {error}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="guest-form">
        <div className="field">
          <label htmlFor={`${id}-name`}>Your name</label>
          <input
            id={`${id}-name`}
            type="text"
            autoComplete="name"
            maxLength={60}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            {...f.fieldProps("name")}
          />
          {f.fieldError("name")}
        </div>

        <fieldset className="field choice-group" {...f.fieldProps("coming")}>
          <legend>Can you come?</legend>
          <div className="choices">
            {COMING.map((c) => (
              <label key={c} className="choice">
                <input
                  type="radio"
                  name={`${id}-coming`}
                  value={c}
                  checked={form.coming === c}
                  onChange={() => set("coming", c)}
                />
                {COMING_CHOICES[c]}
              </label>
            ))}
          </div>
          {f.fieldError("coming")}
        </fieldset>

        {form.coming !== "no" && <GoingFields id={id} form={form} set={set} foods={event.foods} f={f} />}

        <MoreFields id={id} form={form} set={set} groups={event.groups} f={f} />

        <div className="row">
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? "Sending…" : changing ? "Save my reply" : "Send my reply"}
          </button>
          {changing && (
            <button type="button" className="btn btn-link" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
