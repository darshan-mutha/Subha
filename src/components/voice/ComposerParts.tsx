"use client";

import { useId } from "react";
import { SPEECH_LANGUAGES, START_EXAMPLES } from "./options";
import { clock } from "./speech";

/**
 * The calm "Listening" sign shown in place of the box while the host speaks.
 * The running clock is hidden from screen readers so the status is announced
 * once, not every second.
 */
export function ListeningSign({ seconds }: { seconds: number }) {
  return (
    <div className="listening" role="status">
      <span className="listening-dot" aria-hidden="true" />
      <span className="wave" aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${(i % 5) * 0.12}s` }} />
        ))}
      </span>
      <span className="listening-text">
        <strong>
          Listening… <span aria-hidden="true">{clock(seconds)}</span>
        </strong>
        <span className="muted">Your words appear when you stop</span>
      </span>
    </div>
  );
}

interface BarProps {
  supported: boolean;
  recording: boolean;
  busy: boolean;
  ready: boolean;
  lang: string;
  onLang: (lang: string) => void;
  onStart: () => void;
  onStop: () => void;
}

/** The row under the box: speaking language, mic or stop, and send. */
export function ComposerBar({ supported, recording, busy, ready, lang, onLang, onStart, onStop }: BarProps) {
  const langId = useId();
  return (
    <div className="composer-bar">
      {supported && (
        <span className="lang-chip">
          <label htmlFor={langId} className="sr-only">
            Speaking in
          </label>
          <select id={langId} value={lang} onChange={(e) => onLang(e.target.value)} disabled={busy || recording}>
            {SPEECH_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </span>
      )}
      <span className="composer-gap" />
      {supported &&
        (recording ? (
          <button type="button" className="icon-btn stop-btn" onClick={onStop} aria-label="Stop listening">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="3" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="icon-btn mic-btn"
            onClick={onStart}
            disabled={busy}
            aria-label="Speak about your event"
            title="Speak"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-2.07A7 7 0 0 0 19 12h-2Z" />
            </svg>
          </button>
        ))}
      {!recording && (
        <button
          type="submit"
          className={`icon-btn send-btn ${ready ? "" : "is-empty"}`}
          disabled={busy}
          aria-label="Continue"
          title="Continue"
        >
          {busy ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

/** One-tap example chips that fill the box. */
export function StartExamples({ disabled, onPick }: { disabled: boolean; onPick: (text: string) => void }) {
  return (
    <div className="examples start-examples" role="group" aria-label="Try an example">
      <span className="examples-label">Or try one:</span>
      {START_EXAMPLES.map((ex) => (
        <button key={ex.label} type="button" className="chip" disabled={disabled} onClick={() => onPick(ex.text)}>
          {ex.label}
        </button>
      ))}
    </div>
  );
}
