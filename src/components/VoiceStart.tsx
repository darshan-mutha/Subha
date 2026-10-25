"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_AUDIO_SECONDS } from "@/lib/audio";

export type VoicePayload = { audio: { mimeType: string; data: string } } | { text: string };

interface Props {
  busy: boolean;
  error: string;
  onSubmit: (payload: VoicePayload) => void;
  onUseForm: () => void;
}

const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function canRecord(): boolean {
  return (
    typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
  );
}

/** Voice-first start: record a short voice note, or type a sentence instead. */
export function VoiceStart({ busy, error, onSubmit, onUseForm }: Props) {
  const [supported] = useState(canRecord);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState("");
  const [text, setText] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (limitRef.current) clearTimeout(limitRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (limitRef.current) clearTimeout(limitRef.current);
    timerRef.current = null;
    limitRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  async function start() {
    setMicError("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("Shubā could not use your microphone. Please allow microphone access, or type your event below.");
      return;
    }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (blob.size < 1000) {
        setMicError("That recording was too short. Please hold on a little longer and speak clearly.");
        return;
      }
      const data = await blobToBase64(blob);
      onSubmit({ audio: { mimeType: blob.type, data } });
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    limitRef.current = setTimeout(stop, MAX_AUDIO_SECONDS * 1000);
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (text.trim().length < 10) {
      setMicError("Please tell us a little more about your event, for example the date, city, guests and budget.");
      return;
    }
    setMicError("");
    onSubmit({ text: text.trim() });
  }

  const message = micError || error;
  const remaining = MAX_AUDIO_SECONDS - seconds;

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
            <span className="sr-only">{recording ? "Stop recording" : "Start recording a voice note"}</span>
          </button>
          <p className="voice-title" aria-hidden="true">
            {busy
              ? "Listening to your voice note…"
              : recording
                ? "Recording… tap to finish"
                : "Tap and tell Shubā about your event"}
          </p>
          <p id="voice-help" className="muted voice-help">
            {recording
              ? `${remaining} seconds left`
              : "Say what you're celebrating, the date, city, number of guests and budget. Any Indian language is fine."}
          </p>
          <p className="voice-example muted">
            e.g. “My daughter&apos;s 5th birthday on 12th December in Bengaluru, about 40 people, budget fifty thousand,
            jungle theme.”
          </p>
          <p className="sr-only" role="status" aria-live="polite">
            {recording ? "Recording started" : ""}
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
            maxLength={500}
            placeholder="Wedding in Jaipur on 20 Feb, 250 guests, 15 lakh, royal theme"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy || recording}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || recording}>
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
