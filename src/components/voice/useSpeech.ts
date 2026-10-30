"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_LISTEN_SECONDS, getRecognition, speechErrorMessage, type Recognition } from "./speech";

/** Listens through the browser's speech recognition and hands over the whole sentence when it stops. */
export function useSpeech(onHeard: (spoken: string) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState("");
  const [lang, setLang] = useState<string>("en-IN");
  const recognitionRef = useRef<Recognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokenRef = useRef({ final: "", interim: "" });

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
    onHeard(`${final} ${interim}`);
    setRecording(false);
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
      const message = speechErrorMessage(event.error);
      if (message) setMicError(message);
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

  return { recording, seconds, micError, setMicError, lang, setLang, start, stop };
}
