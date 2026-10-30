"use client";

import { useState } from "react";
import { TRADITIONAL_EVENT_TYPES, type EventType } from "@/lib/schemas";
import { EMPTY_FORM, type FormValues } from "./formValues";

/** Updates one form value; event type also sets the muhurat box until the host has touched it. */
export type UpdateField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;

/** Adds or removes one choice from a multi-choice list (focus areas or guest needs). */
export type ToggleChoice = <K extends "focus" | "guestNeeds">(
  key: K,
  value: FormValues[K][number],
  on: boolean,
) => void;

/** Holds the form values, its own field errors and whether the muhurat box was touched. */
export function useEventFormState(initial: FormValues, initialErrors: Record<string, string>) {
  const [values, setValues] = useState<FormValues>(() => ({ ...EMPTY_FORM, ...initial }));
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [muhuratTouched, setMuhuratTouched] = useState(initial !== EMPTY_FORM);

  const update: UpdateField = (key, value) => {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "eventType" && !muhuratTouched) {
        next.includeMuhurat = TRADITIONAL_EVENT_TYPES.has(value as EventType);
      }
      return next;
    });
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const toggle: ToggleChoice = (key, value, on) => {
    setValues((v) => {
      const list = v[key] as string[];
      const next = on ? [...list.filter((x) => x !== value), value] : list.filter((x) => x !== value);
      return { ...v, [key]: next };
    });
  };

  function loadExample(example: FormValues) {
    setValues(example);
    setErrors({});
    setMuhuratTouched(false);
  }

  return { values, setValues, errors, setErrors, update, toggle, loadExample, setMuhuratTouched };
}
