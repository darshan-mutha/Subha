"use client";

import type { FormEvent, RefObject } from "react";
import { COMING, type Coming, type GuestEvent } from "@/lib/rsvp";
import { fullDate } from "@/lib/dates";
import { PetalMark } from "../Brand";
import { fieldErrorWiring } from "../fieldErrors";
import { GoingFields, MoreFields, type SetField } from "./ReplyFields";
import type { ReplyForm } from "./useGuestReply";

const COMING_CHOICES: Record<Coming, string> = { yes: "Yes, we're coming", maybe: "Maybe", no: "Sorry, can't come" };

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
  const f = fieldErrorWiring(id, errors);
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
            {...f.invalid("name")}
          />
          {f.err("name")}
        </div>

        <fieldset className="field choice-group" {...f.invalid("coming")}>
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
          {f.err("coming")}
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
