"use client";

import { INVITE_LANGUAGES, INVITE_TONES, TONE_LABELS, type InviteDetails, type InviteWording } from "@/lib/invite";
import type { Errors } from "./useInviteEditor";
import { invalidAttrs } from "../fieldErrors";

type SetDetail = <K extends keyof InviteDetails>(key: K, value: InviteDetails[K]) => void;
/** The card details typed as free text (language and tone are picked from lists). */
type TextDetail = "hosts" | "venue" | "time" | "note";

interface DetailFieldProps {
  uid: string;
  name: TextDetail;
  label: string;
  max: number;
  placeholder: string;
  hint?: string;
  details: InviteDetails;
  errors: Errors;
  setDetail: SetDetail;
  onBlur?: () => void;
}

/** One text box for a card detail, with its hint or error. */
export function DetailField({
  uid,
  name,
  label,
  max,
  placeholder,
  hint,
  details,
  errors,
  setDetail,
  onBlur,
}: DetailFieldProps) {
  return (
    <div className="field">
      <label htmlFor={`${uid}-${name}`}>{label}</label>
      <input
        id={`${uid}-${name}`}
        type="text"
        maxLength={max}
        placeholder={placeholder}
        value={details[name]}
        {...invalidAttrs(`${uid}-${name}-err`, errors[name], hint ? `${uid}-${name}-hint` : undefined)}
        onChange={(e) => setDetail(name, e.target.value)}
        onBlur={onBlur}
      />
      {hint && !errors[name] && (
        <span id={`${uid}-${name}-hint`} className="hint">
          {hint}
        </span>
      )}
      {errors[name] && (
        <span id={`${uid}-${name}-err`} className="field-error">
          {errors[name]}
        </span>
      )}
    </div>
  );
}

interface FieldsProps {
  uid: string;
  details: InviteDetails;
  errors: Errors;
  setDetail: SetDetail;
}

/** Language, hosts and tone: what shapes how the words are written. */
export function VoiceFields({ uid, details, errors, setDetail }: FieldsProps) {
  const shared = { uid, details, errors, setDetail };
  return (
    <>
      <div className="grid">
        <div className="field">
          <label htmlFor={`${uid}-language`}>Language</label>
          <select
            id={`${uid}-language`}
            value={details.language}
            onChange={(e) => {
              const picked = INVITE_LANGUAGES.find((l) => l.code === e.target.value);
              if (picked) setDetail("language", picked.code);
            }}
          >
            {INVITE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.code === "en" ? l.label : `${l.label} (${l.name})`}
              </option>
            ))}
          </select>
        </div>
        <DetailField
          {...shared}
          name="hosts"
          label="Hosted by (optional)"
          max={80}
          placeholder="e.g. The Sharma family"
        />
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
}

/** Venue, time and note: printed on the card exactly as given. */
export function FactFields({ city, onBlur, ...shared }: FieldsProps & { city: string; onBlur?: () => void }) {
  return (
    <div className="grid">
      <DetailField
        {...shared}
        name="venue"
        label="Venue (optional)"
        max={120}
        placeholder="e.g. Sri Krishna Kalyana Mantapa"
        hint={`We add ${city} for you.`}
        onBlur={onBlur}
      />
      <DetailField
        {...shared}
        name="time"
        label="Time (optional)"
        max={40}
        placeholder="e.g. 7:00 PM onwards"
        onBlur={onBlur}
      />
      <div className="span-2">
        <DetailField
          {...shared}
          name="note"
          label="Anything else for guests (optional)"
          max={160}
          placeholder="e.g. Dress code: ethnic. Reply to Priya, 98450 12345"
          onBlur={onBlur}
        />
      </div>
    </div>
  );
}

interface WordFieldProps {
  uid: string;
  name: keyof InviteWording;
  label: string;
  max: number;
  long?: boolean;
  wording: InviteWording;
  errors: Errors;
  onWord: (key: keyof InviteWording, value: string) => void;
  onBlur: () => void;
}

/** One editable line (or paragraph) of the card's words. */
export function WordField({ uid, name, label, max, long = false, wording, errors, onWord, onBlur }: WordFieldProps) {
  const props = {
    id: `${uid}-w-${name}`,
    value: wording[name],
    maxLength: max,
    ...invalidAttrs(`${uid}-w-${name}-err`, errors[name]),
    onBlur,
  };
  return (
    <div className="field">
      <label htmlFor={props.id}>{label}</label>
      {long ? (
        <textarea {...props} rows={4} onChange={(e) => onWord(name, e.target.value)} />
      ) : (
        <input {...props} type="text" onChange={(e) => onWord(name, e.target.value)} />
      )}
      {errors[name] && (
        <span id={`${uid}-w-${name}-err`} className="field-error">
          {errors[name]}
        </span>
      )}
    </div>
  );
}
