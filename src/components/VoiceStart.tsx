"use client";

import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ComposerBar, ListeningSign, StartExamples } from "./voice/ComposerParts";
import { MAX_CHARS, canRecord, joinSpoken } from "./voice/speech";
import { useSpeech } from "./voice/useSpeech";

export { SPEECH_LANGUAGES, START_EXAMPLES } from "./voice/options";
export { canRecord, joinSpoken } from "./voice/speech";

export type VoicePayload = { text: string };

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
      setMicError("Please tell us a little more about your event, for example the date, city, guests and budget.");
      boxRef.current?.focus();
      return;
    }
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
    setText(example);
    requestAnimationFrame(() => boxRef.current?.focus());
  }

  const message = micError || error;

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
        <p className="form-error" role="alert">
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
