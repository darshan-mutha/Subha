"use client";

import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { invalidAttrs } from "./fieldErrors";
import { ComposerBar, ListeningSign, StartExamples } from "./voice/ComposerParts";
import { MAX_CHARS, canRecord, joinSpoken } from "./voice/speech";
import { useSpeech } from "./voice/useSpeech";

export { SPEECH_LANGUAGES, START_EXAMPLES } from "./voice/options";
export { canRecord, joinSpoken } from "./voice/speech";

export type VoicePayload = { text: string };

const ERROR_ID = "describe-event-error";
const TOO_SHORT = "Please tell us a little more about your event, for example the date, city, guests and budget.";

interface Props {
  busy: boolean;
  error: string;
  onSubmit: (payload: VoicePayload) => void;
  onUseForm: () => void;
}

/**
 * Chat-style start: one box to type in, with a small mic inside it. While the
 * host speaks, the box shows a calm "Listening" sign instead of half-heard
 * words; when they stop, the whole sentence drops into the box to check, edit
 * and send. The browser does the listening, so no audio ever reaches Shubā.
 */
export function VoiceStart({ busy, error, onSubmit, onUseForm }: Props) {
  const [supported] = useState(canRecord);
  const [text, setText] = useState("");
  // The box itself has a problem (too little said), as opposed to the mic or the server.
  const [tooShort, setTooShort] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const { recording, seconds, micError, setMicError, lang, setLang, start, stop } = useSpeech((spoken) => {
    setText((before) => joinSpoken(before, spoken));
    requestAnimationFrame(() => boxRef.current?.focus());
  });

  // Let the box grow with its text, like a chat composer.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [text, recording]);

  function send() {
    if (text.trim().length < 10) {
      setMicError("");
      setTooShort(true);
      boxRef.current?.focus();
      return;
    }
    setTooShort(false);
    setMicError("");
    onSubmit({ text: text.trim() });
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recording) return;
    send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a new line (as in most chat apps).
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!busy) send();
    }
  }

  function pickExample(example: string) {
    setMicError("");
    setTooShort(false);
    setText(example);
    requestAnimationFrame(() => boxRef.current?.focus());
  }

  const message = (tooShort ? TOO_SHORT : "") || micError || error;

  return (
    <div className="start">
      <form onSubmit={submitText} className={`composer ${recording ? "is-listening" : ""}`} aria-busy={busy}>
        <label htmlFor="describe-event" className="sr-only">
          Describe your event
        </label>
        {recording ? (
          <ListeningSign seconds={seconds} />
        ) : (
          <textarea
            id="describe-event"
            ref={boxRef}
            rows={2}
            maxLength={MAX_CHARS}
            placeholder="What are you celebrating? When, where, how many guests and budget…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            {...invalidAttrs(ERROR_ID, tooShort ? TOO_SHORT : undefined)}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
        )}
        <ComposerBar
          supported={supported}
          recording={recording}
          busy={busy}
          ready={text.trim().length > 0}
          lang={lang}
          onLang={setLang}
          onStart={start}
          onStop={stop}
        />
      </form>

      {message && (
        <p id={ERROR_ID} className="form-error" role="alert">
          {message}
        </p>
      )}
      {busy ? (
        <p className="loading">Understanding your event…</p>
      ) : (
        <StartExamples disabled={recording} onPick={pickExample} />
      )}

      <button type="button" className="btn btn-link" onClick={onUseForm} disabled={busy || recording}>
        Prefer a form? Fill in the details yourself
      </button>
    </div>
  );
}
