"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export type VoicePayload = { text: string };

interface Props {
  busy: boolean;
  error: string;
  onSubmit: (payload: VoicePayload) => void;
  onUseForm: () => void;
}

/** Languages the browser can listen in. The host picks one; mixing in English usually works. */
export const SPEECH_LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "mr-IN", label: "मराठी" },
  { code: "bn-IN", label: "বাংলা" },
] as const;

/** One-tap starters: each fills the box with a complete sentence the host can edit. */
export const START_EXAMPLES = [
  {
    label: "5th birthday in Bengaluru",
    text: "My daughter's 5th birthday on 12 December in Bengaluru, about 40 guests, budget ₹50,000, jungle theme",
  },
  {
    label: "3-day wedding in Jaipur",
    text: "3-day wedding in Jaipur on 14 February, 250 guests, budget ₹25 lakh. We are Marwari, the groom's side is Punjabi. Mehendi and sangeet on day 1, pheras on day 3",
  },
  {
    label: "Griha pravesh in Mysuru",
    text: "Griha pravesh in Mysuru on 18 January, 60 guests, budget ₹1.5 lakh, simple and traditional",
  },
] as const;

const MAX_LISTEN_SECONDS = 60;
const MAX_CHARS = 500;

/** The small slice of the browser's speech recognition API that Shubā uses. */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function canRecord(): boolean {
  return !!getRecognition();
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Join what was already typed with what was just said. */
export function joinSpoken(before: string, spoken: string): string {
  const said = spoken.replace(/\s+/g, " ").trim();
  if (!said) return before;
  const typed = before.trim();
  return (typed ? `${typed} ${said}` : said).slice(0, MAX_CHARS);
}

/**
 * Chat-style start: one box to type in, with a small mic inside it. While the
 * host speaks, the box shows a calm "Listening" sign instead of half-heard
 * words; when they stop, the whole sentence drops into the box to check, edit
 * and send. The browser does the listening, so no audio ever reaches Shubā.
 */
export function VoiceStart({ busy, error, onSubmit, onUseForm }: Props) {
  const [supported] = useState(canRecord);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState("");
  const [text, setText] = useState("");
  const [lang, setLang] = useState<string>("en-IN");
  const recognitionRef = useRef<Recognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokenRef = useRef({ final: "", interim: "" });
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  // Let the box grow with its text, like a chat composer.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [text, recording]);

  function clearTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (limitRef.current) clearTimeout(limitRef.current);
    timerRef.current = null;
    limitRef.current = null;
  }

  useEffect(
    () => () => {
      clearTimers();
      recognitionRef.current?.abort();
    },
    [],
  );

  /** Put everything heard into the box, once, when listening ends. */
  function finish() {
    clearTimers();
    const { final, interim } = spokenRef.current;
    spokenRef.current = { final: "", interim: "" };
    setText((before) => joinSpoken(before, `${final} ${interim}`));
    setRecording(false);
    requestAnimationFrame(() => boxRef.current?.focus());
  }

  function stop() {
    clearTimers();
    recognitionRef.current?.stop();
  }

  function start() {
    const Ctor = getRecognition();
    if (!Ctor) return;
    setMicError("");
    spokenRef.current = { final: "", interim: "" };
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += `${result[0].transcript} `;
        else interim += `${result[0].transcript} `;
      }
      spokenRef.current = { final, interim };
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicError("Shubā could not use your microphone. Please allow microphone access, or type instead.");
      } else if (event.error === "no-speech") {
        setMicError("Shubā didn't hear anything. Tap the mic and speak, or type instead.");
      } else if (event.error !== "aborted") {
        setMicError("Listening stopped. Please try again, or type instead.");
      }
      finish();
    };
    recognition.onend = finish;

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setMicError("Shubā could not start listening. Please type instead.");
      return;
    }
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    limitRef.current = setTimeout(stop, MAX_LISTEN_SECONDS * 1000);
  }

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

  const message = micError || error;
  const ready = text.trim().length > 0;

  return (
    <div className="start">
      <form onSubmit={submitText} className={`composer ${recording ? "is-listening" : ""}`} aria-busy={busy}>
        <label htmlFor="describe-event" className="sr-only">
          Describe your event
        </label>
        {recording ? (
          <div className="listening" role="status">
            <span className="listening-dot" aria-hidden="true" />
            <span className="wave" aria-hidden="true">
              {Array.from({ length: 11 }, (_, i) => (
                <i key={i} style={{ animationDelay: `${(i % 5) * 0.12}s` }} />
              ))}
            </span>
            <span className="listening-text">
              <strong>Listening… {clock(seconds)}</strong>
              <span className="muted">Your words appear when you stop</span>
            </span>
          </div>
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

        <div className="composer-bar">
          {supported && (
            <span className="lang-chip">
              <label htmlFor="speech-lang" className="sr-only">
                Speaking in
              </label>
              <select
                id="speech-lang"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                disabled={busy || recording}
              >
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
              <button type="button" className="icon-btn stop-btn" onClick={stop} aria-label="Stop listening">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="3" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                className="icon-btn mic-btn"
                onClick={start}
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
      </form>

      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {busy ? (
        <p className="loading">Understanding your event…</p>
      ) : (
        <div className="examples start-examples" role="group" aria-label="Try an example">
          <span className="examples-label">Or try one:</span>
          {START_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              className="chip"
              disabled={recording}
              onClick={() => {
                setMicError("");
                setText(ex.text);
                requestAnimationFrame(() => boxRef.current?.focus());
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-link" onClick={onUseForm} disabled={busy || recording}>
        Prefer a form? Fill in the details yourself
      </button>
    </div>
  );
}
