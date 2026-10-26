"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiError, ApiStatusError, loadGuestEvent, sendReply } from "@/lib/client";
import {
  COMING,
  GUEST_FOOD_LABELS,
  GUEST_GROUP_LABELS,
  GUEST_REPLY_NEED_LABELS,
  GUEST_REPLY_NEEDS,
  MAX_PARTY,
  ReplyInputSchema,
  type Coming,
  type GuestEvent,
  type ReplyInput,
} from "@/lib/rsvp";
import { fieldErrors, type GuestNeed } from "@/lib/schemas";
import { PetalMark } from "./Brand";

const COMING_CHOICES: Record<Coming, string> = { yes: "Yes, we're coming", maybe: "Maybe", no: "Sorry, can't come" };

interface Saved {
  replyId: string;
  secret: string;
  reply: ReplyInput;
}

const storageKey = (token: string) => `shuba:rsvp:${token}`;

function loadSaved(token: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(token));
    const saved = raw ? (JSON.parse(raw) as Saved) : null;
    return saved?.replyId && saved.secret && saved.reply ? saved : null;
  } catch {
    return null;
  }
}

function keepSaved(token: string, saved: Saved) {
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(saved));
  } catch {
    /* the reply is sent either way; this only lets the guest change it later */
  }
}

function niceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function replySentence(reply: ReplyInput): string {
  if (reply.coming === "no") return "You can't come. The hosts will miss you.";
  const parts = [`${reply.adults} adult${reply.adults === 1 ? "" : "s"}`];
  if (reply.kids) parts.push(`${reply.kids} child${reply.kids === 1 ? "" : "ren"}`);
  return `${reply.coming === "yes" ? "Coming" : "Maybe coming"}: ${parts.join(" and ")}.`;
}

interface Form {
  name: string;
  phone: string;
  coming: Coming | "";
  adults: string;
  kids: string;
  food: ReplyInput["food"];
  group: ReplyInput["group"];
  needs: GuestNeed[];
  note: string;
}

const EMPTY: Form = {
  name: "",
  phone: "",
  coming: "",
  adults: "1",
  kids: "0",
  food: "any",
  group: "",
  needs: [],
  note: "",
};

const toForm = (r: ReplyInput): Form => ({
  ...r,
  adults: String(r.coming === "no" ? 1 : r.adults),
  kids: String(r.kids),
});

/** The page a guest opens from the reply link. Shows the invitation and takes their reply. */
export function GuestReply({ token }: { token: string }) {
  const id = useId();
  const [event, setEvent] = useState<GuestEvent | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saved, setSaved] = useState<Saved | null>(() => loadSaved(token));
  const [editing, setEditing] = useState(() => !loadSaved(token));
  const [form, setForm] = useState<Form>(() => (saved ? toForm(saved.reply) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const thanksRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    loadGuestEvent(token).then(setEvent, (e: unknown) =>
      setLoadError(e instanceof ApiError ? e.message : "Could not load the invitation. Please try again."),
    );
  }, [token]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = ReplyInputSchema.safeParse({
      ...form,
      coming: form.coming || undefined,
      adults: form.adults === "" ? 0 : form.adults,
      kids: form.kids === "" ? 0 : form.kids,
    });
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      setError("Please check the highlighted answers.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setErrors({});
    setError("");
    try {
      const reply = parsed.data;
      let result: { replyId: string; secret: string };
      try {
        result = await sendReply(token, { reply, replyId: saved?.replyId, secret: saved?.secret });
      } catch (err) {
        // The reply could not be changed (e.g. removed by the hosts): send it as new.
        if (!saved || !(err instanceof ApiStatusError) || err.status !== 403) throw err;
        result = await sendReply(token, { reply });
      }
      const next = { replyId: result.replyId, secret: result.secret, reply };
      keepSaved(token, next);
      setSaved(next);
      setEditing(false);
      requestAnimationFrame(() => thanksRef.current?.focus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your reply. Please try again.");
      if (err instanceof ApiError) setErrors(err.fields);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="card guest-page">
        <h1 className="section-title">Invitation not found</h1>
        <p role="alert">{loadError}</p>
      </div>
    );
  }
  if (!event) {
    return (
      <p className="loading" role="status">
        <span className="spinner" aria-hidden="true" /> Loading the invitation…
      </p>
    );
  }

  const fieldProps = (name: string) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-err` : undefined,
  });
  const fieldError = (name: string) =>
    errors[name] ? (
      <p className="field-error" id={`${id}-${name}-err`}>
        {errors[name]}
      </p>
    ) : null;
  const going = form.coming !== "no";

  return (
    <div className="guest-page">
      <header className="card guest-invite">
        <PetalMark size={56} filled={2} />
        <p className="eyebrow">{event.title}</p>
        <h1>{event.heading}</h1>
        <p>{event.message}</p>
        <ul className="facts" aria-label="When and where">
          <li>{niceDate(event.date)}</li>
          {event.time && <li>{event.time}</li>}
          <li>{event.venue}</li>
        </ul>
        {event.closing && <p className="muted">{event.closing}</p>}
      </header>

      {saved && !editing ? (
        <section className="card guest-thanks" aria-labelledby={`${id}-thanks`}>
          <h2 id={`${id}-thanks`} ref={thanksRef} tabIndex={-1} className="section-title">
            Thank you, {saved.reply.name}!
          </h2>
          <p>
            We&rsquo;ve told the hosts. <strong>{replySentence(saved.reply)}</strong>
          </p>
          {event.open ? (
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              Change my reply
            </button>
          ) : (
            <p className="muted small">The hosts are no longer taking changes.</p>
          )}
        </section>
      ) : !event.open ? (
        <section className="card">
          <h2 className="section-title">Replies are closed</h2>
          <p>The hosts are no longer taking replies online. Please contact them directly.</p>
        </section>
      ) : (
        <section className="card" aria-labelledby={`${id}-form`}>
          <h2 id={`${id}-form`} className="section-title">
            {saved ? "Change your reply" : "Will you join us?"}
          </h2>
          {error && (
            <p className="form-error" role="alert" ref={errorRef} tabIndex={-1}>
              {error}
            </p>
          )}
          <form onSubmit={submit} noValidate className="guest-form">
            <div className="field">
              <label htmlFor={`${id}-name`}>Your name</label>
              <input
                id={`${id}-name`}
                type="text"
                autoComplete="name"
                maxLength={60}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                {...fieldProps("name")}
              />
              {fieldError("name")}
            </div>

            <fieldset className="field choice-group" {...fieldProps("coming")}>
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
              {fieldError("coming")}
            </fieldset>

            {going && (
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
                      {...fieldProps("adults")}
                    />
                    {fieldError("adults")}
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
                      {...fieldProps("kids")}
                    />
                    {fieldError("kids")}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor={`${id}-food`}>Food</label>
                  <select
                    id={`${id}-food`}
                    value={form.food}
                    onChange={(e) => set("food", e.target.value as Form["food"])}
                  >
                    {event.foods.map((f) => (
                      <option key={f} value={f}>
                        {GUEST_FOOD_LABELS[f]}
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
            )}

            <div className="field">
              <label htmlFor={`${id}-group`}>You are from (optional)</label>
              <select
                id={`${id}-group`}
                value={form.group}
                onChange={(e) => set("group", e.target.value as Form["group"])}
              >
                <option value="">Choose…</option>
                {event.groups.map((g) => (
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
                {...fieldProps("note")}
              />
              {fieldError("note")}
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
                {...fieldProps("phone")}
              />
              <p className="hint">Only the hosts see it, so they can reach you about the event.</p>
              {fieldError("phone")}
            </div>

            <div className="row">
              <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
                {busy ? "Sending…" : saved ? "Save my reply" : "Send my reply"}
              </button>
              {saved && (
                <button type="button" className="btn btn-link" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}
      <p className="small muted guest-footer">Made with Shubā — plan any celebration in minutes.</p>
    </div>
  );
}
