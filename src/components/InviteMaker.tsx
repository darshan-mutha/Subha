"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError, requestInvite } from "@/lib/client";
import {
  EMPTY_DETAILS,
  INVITE_LANGUAGES,
  INVITE_LOOKS,
  INVITE_TONES,
  InviteDetailsSchema,
  InviteWordingSchema,
  LOOK_LABELS,
  TONE_LABELS,
  inviteAltText,
  inviteFacts,
  inviteMessage,
  type Invite,
  type InviteDetails,
  type InviteLook,
  type InviteWording,
} from "@/lib/invite";
import { LOOK_PALETTES, renderInviteCard } from "@/lib/inviteCard";
import { fieldErrors, type EventInput } from "@/lib/schemas";
import { whatsappLink } from "@/lib/team";
import { CopyButton } from "./PlanSections";

interface Props {
  input: EventInput;
  invite: Invite | null;
  /** Saves the invite with the plan. May reject (e.g. offline). */
  onSave: (invite: Invite | null) => Promise<void>;
}

type Errors = Record<string, string>;

function fileName(input: EventInput): string {
  const base = (input.eventName || input.eventType)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "shuba"}-invite.png`;
}

/**
 * Invite tab: the host gives a few details, Claude writes the words in their
 * language, and Shubā draws a card they can download or send on WhatsApp.
 */
export function InviteMaker({ input, invite, onSave }: Props) {
  const uid = useId();
  const [details, setDetails] = useState<InviteDetails>(invite?.details ?? EMPTY_DETAILS);
  const [wording, setWording] = useState<InviteWording | null>(invite?.wording ?? null);
  const [look, setLook] = useState<InviteLook>(invite?.look ?? "peacock");
  const [source, setSource] = useState<Invite["source"]>(invite?.source ?? "ai");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null);
  const [drawFailed, setDrawFailed] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [dirty, setDirty] = useState(false);
  const wordingRef = useRef<HTMLHeadingElement>(null);

  // Take in changes saved elsewhere (another helper on a shared plan) unless the host is mid-edit.
  const [seen, setSeen] = useState(invite);
  if (invite !== seen) {
    setSeen(invite);
    if (!dirty && invite) {
      setDetails(invite.details);
      setWording(invite.wording);
      setLook(invite.look);
      setSource(invite.source);
    }
  }

  const facts = useMemo(() => inviteFacts(input, details), [input, details]);
  const message = wording ? inviteMessage(wording, facts) : "";

  // Draw the card whenever its words, facts or look change.
  useEffect(() => {
    if (!wording) return;
    let cancelled = false;
    let url = "";
    const timer = setTimeout(async () => {
      const blob = await renderInviteCard(wording, facts, look);
      if (cancelled) return;
      if (!blob) {
        setDrawFailed(true);
        return;
      }
      url = URL.createObjectURL(blob);
      setDrawFailed(false);
      setImage({ url, blob });
      try {
        setCanShareFiles(
          Boolean(navigator.canShare?.({ files: [new File([blob], "invite.png", { type: "image/png" })] })),
        );
      } catch {
        setCanShareFiles(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }, [wording, facts, look]);

  function setDetail<K extends keyof InviteDetails>(key: K, value: InviteDetails[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  async function save(next: Invite | null, done: string) {
    try {
      await onSave(next);
      setDirty(false);
      setStatus(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the invite. Please check your connection.");
    }
  }

  async function write(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    const parsed = InviteDetailsSchema.safeParse(details);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    setStatus("Writing your invite…");
    try {
      const reply = await requestInvite(input, parsed.data);
      setWording(reply.wording);
      setSource(reply.source);
      setDetails(parsed.data);
      await save(
        { details: parsed.data, wording: reply.wording, look, source: reply.source },
        "Your invite is ready. You can change any words below.",
      );
      requestAnimationFrame(() => wordingRef.current?.focus());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  /** Saves edits to the words or card details, after checking them. */
  function commit(nextLook: InviteLook = look) {
    if (!wording) return;
    const checked = InviteWordingSchema.safeParse(wording);
    const checkedDetails = InviteDetailsSchema.safeParse(details);
    const errs = {
      ...(checked.success ? {} : fieldErrors(checked.error)),
      ...(checkedDetails.success ? {} : fieldErrors(checkedDetails.error)),
    };
    setErrors(errs);
    if (!checked.success || !checkedDetails.success) return;
    void save({ details: checkedDetails.data, wording: checked.data, look: nextLook, source }, "Saved");
  }

  async function shareCard() {
    if (!image) return;
    try {
      await navigator.share({
        files: [new File([image.blob], fileName(input), { type: "image/png" })],
        text: message,
      });
    } catch {
      /* the host closed the share sheet */
    }
  }

  const field = (
    key: keyof InviteDetails,
    label: string,
    max: number,
    placeholder: string,
    hint?: string,
    onBlur?: () => void,
  ) => (
    <div className="field">
      <label htmlFor={`${uid}-${key}`}>{label}</label>
      <input
        id={`${uid}-${key}`}
        type="text"
        maxLength={max}
        placeholder={placeholder}
        value={details[key]}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `${uid}-${key}-err` : hint ? `${uid}-${key}-hint` : undefined}
        onChange={(e) => setDetail(key, e.target.value as never)}
        onBlur={onBlur}
      />
      {hint && !errors[key] && (
        <span id={`${uid}-${key}-hint`} className="hint">
          {hint}
        </span>
      )}
      {errors[key] && (
        <span id={`${uid}-${key}-err`} className="field-error">
          {errors[key]}
        </span>
      )}
    </div>
  );

  const voiceFields = (
    <>
      <div className="grid">
        <div className="field">
          <label htmlFor={`${uid}-language`}>Language</label>
          <select
            id={`${uid}-language`}
            value={details.language}
            onChange={(e) => setDetail("language", e.target.value as InviteDetails["language"])}
          >
            {INVITE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.code === "en" ? l.label : `${l.label} (${l.name})`}
              </option>
            ))}
          </select>
        </div>
        {field("hosts", "Hosted by (optional)", 80, "e.g. The Sharma family")}
      </div>
      <fieldset className="choice-group">
        <legend>Tone</legend>
        <div className="choices">
          {INVITE_TONES.map((t) => (
            <label key={t} className={`choice ${details.tone === t ? "is-on" : ""}`}>
              <input
                type="radio"
                name={`${uid}-tone`}
                value={t}
                checked={details.tone === t}
                onChange={() => setDetail("tone", t)}
              />
              {TONE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );

  const factFields = (onBlur?: () => void) => (
    <div className="grid">
      {field(
        "venue",
        "Venue (optional)",
        120,
        "e.g. Sri Krishna Kalyana Mantapa",
        `We add ${input.city} for you.`,
        onBlur,
      )}
      {field("time", "Time (optional)", 40, "e.g. 7:00 PM onwards", undefined, onBlur)}
      <div className="span-2">
        {field(
          "note",
          "Anything else for guests (optional)",
          160,
          "e.g. Dress code: ethnic. Reply to Priya, 98450 12345",
          undefined,
          onBlur,
        )}
      </div>
    </div>
  );

  if (!wording) {
    return (
      <div className="invite">
        <h3 className="section-title">Make your invitation</h3>
        <p className="muted">
          Tell Shubā a few details. It writes the invitation in your language and makes a card you can send on WhatsApp.
          The date, time and venue are printed exactly as you give them.
        </p>
        <form onSubmit={write} noValidate aria-busy={busy}>
          {voiceFields}
          {factFields()}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Writing…" : "Write my invite"}
          </button>
          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
          {busy && (
            <p className="loading" aria-hidden="true">
              <span className="spinner" /> Writing your invite… about 10–20 seconds.
            </p>
          )}
        </form>
      </div>
    );
  }

  const alt = inviteAltText(wording, facts);
  const wordField = (key: keyof InviteWording, label: string, max: number, long = false) => {
    const props = {
      id: `${uid}-w-${key}`,
      value: wording[key],
      maxLength: max,
      "aria-invalid": Boolean(errors[key]),
      "aria-describedby": errors[key] ? `${uid}-w-${key}-err` : undefined,
      onBlur: () => commit(),
    };
    return (
      <div className="field">
        <label htmlFor={props.id}>{label}</label>
        {long ? (
          <textarea
            {...props}
            rows={4}
            onChange={(e) => {
              setWording({ ...wording, [key]: e.target.value });
              setDirty(true);
            }}
          />
        ) : (
          <input
            {...props}
            type="text"
            onChange={(e) => {
              setWording({ ...wording, [key]: e.target.value });
              setDirty(true);
            }}
          />
        )}
        {errors[key] && (
          <span id={`${uid}-w-${key}-err`} className="field-error">
            {errors[key]}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="invite">
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      <div className="invite-layout">
        <figure className="invite-preview">
          {image && !drawFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- a locally drawn image, not a remote asset
            <img src={image.url} alt={alt} width={1080} height={1350} />
          ) : drawFailed ? (
            <div className={`invite-text-card look-${look}`} role="img" aria-label={alt}>
              <p className="invite-text-heading">{wording.heading}</p>
              <p>{wording.message}</p>
              <p>
                <strong>{facts.date}</strong>
                {facts.time && <> · {facts.time}</>}
                <br />
                {facts.venue}
              </p>
              {facts.note && <p className="small">{facts.note}</p>}
              <p className="invite-text-heading">{wording.closing}</p>
            </div>
          ) : (
            <div className="invite-placeholder" aria-hidden="true">
              <span className="spinner" />
            </div>
          )}
          {source === "standard" && (
            <figcaption className="small muted">
              Shubā was busy, so these are standard English words. Tap “Write again” to try in your language.
            </figcaption>
          )}
        </figure>

        <div className="invite-side">
          <fieldset className="choice-group no-print">
            <legend>Card look</legend>
            <div className="choices">
              {INVITE_LOOKS.map((l) => (
                <label key={l} className={`choice ${look === l ? "is-on" : ""}`}>
                  <input
                    type="radio"
                    name={`${uid}-look`}
                    value={l}
                    checked={look === l}
                    onChange={() => {
                      setLook(l);
                      commit(l);
                    }}
                  />
                  <span
                    className="look-swatch"
                    aria-hidden="true"
                    style={{ background: LOOK_PALETTES[l].bg[0], borderColor: LOOK_PALETTES[l].border }}
                  />
                  {LOOK_LABELS[l]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="row no-print">
            {canShareFiles && image && (
              <button type="button" className="btn btn-primary" onClick={() => void shareCard()}>
                Share card
              </button>
            )}
            <a
              className={`btn ${canShareFiles ? "" : "btn-primary"}`}
              href={whatsappLink(message)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Send on WhatsApp
            </a>
            {image && (
              <a className="btn" href={image.url} download={fileName(input)}>
                Download image
              </a>
            )}
            <CopyButton text={message} label="message" />
          </div>
          <p className="small muted no-print">
            Tip: download the card, then attach it in WhatsApp with the message. Changing the event date in your plan
            updates the card too.
          </p>
        </div>
      </div>

      <section className="invite-edit no-print" aria-labelledby={`${uid}-words`}>
        <h3 id={`${uid}-words`} className="section-title" ref={wordingRef} tabIndex={-1}>
          Change the words
        </h3>
        {wordField("heading", "Heading", 80)}
        {wordField("message", "Invitation", 420, true)}
        {wordField("closing", "Closing line", 120)}
        {factFields(() => commit())}
      </section>

      <details className="invite-rewrite no-print">
        <summary>Change language or tone</summary>
        {voiceFields}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn" disabled={busy} onClick={() => void write()}>
          {busy ? "Writing…" : "Write again"}
        </button>
        {busy && (
          <p className="loading" aria-hidden="true">
            <span className="spinner" /> Writing your invite… about 10–20 seconds.
          </p>
        )}
      </details>
    </div>
  );
}
