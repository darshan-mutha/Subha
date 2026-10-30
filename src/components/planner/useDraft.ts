"use client";

import { useState } from "react";
import type { FormValues } from "../event-form/formValues";

/** The details form being filled in: starting values, what a voice note heard, and fields it missed. */
export function useDraft() {
  const [editing, setEditing] = useState<FormValues | undefined>(undefined);
  const [heard, setHeard] = useState("");
  const [missing, setMissing] = useState<Record<string, string>>({});
  const [formKey, setFormKey] = useState(0);

  /** Clears the draft without remounting the form. */
  function clear() {
    setEditing(undefined);
    setHeard("");
    setMissing({});
  }

  /** Starts a fresh form, optionally filled with values. */
  function open(values?: FormValues) {
    setEditing(values);
    setHeard("");
    setMissing({});
    setFormKey((k) => k + 1);
  }

  /** Starts a fresh form from what a voice note understood. */
  function fromVoice(values: FormValues, missed: Record<string, string>, transcript: string) {
    setEditing(values);
    setMissing(missed);
    setHeard(transcript);
    setFormKey((k) => k + 1);
  }

  return { editing, heard, missing, formKey, clear, open, fromVoice };
}

/** What `useDraft` returns. */
export type Draft = ReturnType<typeof useDraft>;
