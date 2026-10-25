"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

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

/**
 * Voice-first start: the browser turns speech into text as the host talks, the
 * words appear in the box to check or edit, then only that text is sent to
 * Shubā. No audio ever leaves the browser for Shubā's server.
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
  const baseRef = useRef("");

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

  function stop() {
    clearTimers();
    recognitionRef.current?.stop();
    setRecording(false);
  }

  function start() {
    const Ctor = getRecognition();
    if (!Ctor) return;
    setMicError("");
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    baseRef.current = text.trim() ? `${text.trim()} ` : "";

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setText((baseRef.current + finalText + interim).slice(0, MAX_CHARS));
    };
    recognition.onerror = (event) => {
      clearTimers();
      setRecording(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicError("Shubā could not use your microphone. Please allow microphone access, or type your event below.");
      } else if (event.error === "no-speech") {
        setMicError("Shubā didn't hear anything. Please tap the mic and speak, or type your event below.");
      } else if (event.error !== "aborted") {
        setMicError("Listening stopped. Please try again, or type your event below.");
      }
    };
    recognition.onend = () => {
      clearTimers();
      setRecording(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setMicError("Shubā could not start listening. Please type your event below.");
      return;
    }
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    limitRef.current = setTimeout(stop, MAX_LISTEN_SECONDS * 1000);
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (recording) stop();
    if (text.trim().length < 10) {
      setMicError("Please tell us a little more about your event, for example the date, city, guests and budget.");
      return;
    }
    setMicError("");
    onSubmit({ text: text.trim() });
  }

  const message = micError || error;
  const remaining = MAX_LISTEN_SECONDS - seconds;

  return (
    <div className="card voice-card">
      {supported && (
        <div className="voice">
          <button
            type="button"
            className={`mic ${recording ? "mic-on" : ""}`}
            onClick={recording ? stop : start}
            disabled={busy}
            aria-pressed={recording}
            aria-describedby="voice-help"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="40" height="40" fill="currentColor">
              {recording ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-2.07A7 7 0 0 0 19 12h-2Z" />
              )}
            </svg>
            <span className="sr-only">{recording ? "Stop listening" : "Start speaking about your event"}</span>
          </button>
          <p className="voice-title" aria-hidden="true">
            {recording ? "Listening… tap to finish" : "Tap and tell Shubā about your event"}
          </p>
          <p id="voice-help" className="muted voice-help">
            {recording
              ? `${remaining} seconds left. Your words appear in the box below.`
              : "Say what you're celebrating, the date, city, number of guests and budget."}
          </p>
          <div className="voice-lang">
            <label htmlFor="speech-lang" className="muted">
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
          </div>
          <p className="voice-example muted">
            e.g. “My daughter&apos;s 5th birthday on 12th December in Bengaluru, about 40 people, budget fifty thousand,
            jungle theme.”
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            {recording ? "Listening started" : ""}
          </p>
        </div>
      )}

      <form onSubmit={submitText} className="type-instead" aria-busy={busy}>
        <label htmlFor="describe-event" className="type-label">
          {supported ? "Or type it in one line" : "Describe your event in a sentence or two"}
        </label>
        <div className="refine-form">
          <input
            id="describe-event"
            type="text"
            maxLength={MAX_CHARS}
            placeholder="Wedding in Jaipur on 20 Feb, 250 guests, 15 lakh, royal theme"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            readOnly={recording}
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Continue
          </button>
        </div>
      </form>

      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {busy && (
        <p className="loading" aria-hidden="true">
          <span className="spinner" /> Understanding your event…
        </p>
      )}

      <button type="button" className="btn btn-link" onClick={onUseForm} disabled={busy || recording}>
        Prefer a form? Fill in the details yourself
      </button>
    </div>
  );
}
