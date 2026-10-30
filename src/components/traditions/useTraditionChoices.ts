"use client";

import { useState } from "react";
import {
  ADDITION_FUNCTIONS,
  MAX_FUNCTIONS,
  MULTI_DAY_EVENT_TYPES,
  TRADITIONS,
  additionDay,
  sameFunctions,
  suggestedFunctions,
  usualFunctions,
  type ModernAddition,
} from "@/lib/traditions";
import type { TraditionValues } from "../TraditionPicker";
import { NAME_TEXT } from "@/lib/validation";

type Change = Partial<Omit<TraditionValues, "eventType">>;

/** State and handlers for the tradition picker: re-suggesting functions, ticking, moving and adding them. */
export function useTraditionChoices(values: TraditionValues, onChange: (next: Change) => void) {
  const multiDay = MULTI_DAY_EVENT_TYPES.has(values.eventType);
  // Functions filled in by Shubā (from the traditions, or from a voice note) still follow later changes.
  const [touched, setTouched] = useState(
    () =>
      values.functions.length > 0 &&
      !sameFunctions(
        values.functions,
        suggestedFunctions(values.traditions, values.eventType, values.days, values.additions),
      ),
  );
  const [custom, setCustomText] = useState("");
  const [customError, setCustomError] = useState("");

  /** Re-suggests functions while the host has not changed them by hand. */
  function refresh(next: Change) {
    const merged = { ...values, ...next };
    if (!multiDay) return onChange(next);
    if (!touched) {
      onChange({
        ...next,
        functions: suggestedFunctions(merged.traditions, merged.eventType, merged.days, merged.additions),
      });
      return;
    }
    // Keep the host's choices; days beyond the new number move to the last day.
    onChange({ ...next, functions: merged.functions.map((f) => ({ ...f, day: Math.min(f.day, merged.days) })) });
  }

  function setTraditions(first: string, second: string) {
    const list = [first, second].flatMap((v) => TRADITIONS.find((t) => t === v) ?? []);
    const unique = [...new Set(list)];
    refresh({ traditions: unique });
  }

  const suggested = multiDay ? usualFunctions(values.traditions, values.eventType) : [];
  const additionNames = values.additions.flatMap((a) => ADDITION_FUNCTIONS[a]?.name || []);
  const names = [...new Set([...additionNames, ...suggested, ...values.functions.map((f) => f.name)])];

  function toggleFunction(name: string, on: boolean) {
    setTouched(true);
    if (on) {
      if (values.functions.length >= MAX_FUNCTIONS) return;
      const day = Math.min(values.days, Math.max(1, ...values.functions.map((f) => f.day)));
      onChange({ functions: [...values.functions, { name, day }] });
    } else {
      onChange({ functions: values.functions.filter((f) => f.name !== name) });
    }
  }

  function moveFunction(name: string, day: number) {
    setTouched(true);
    onChange({ functions: values.functions.map((f) => (f.name === name ? { ...f, day } : f)) });
  }

  function setCustom(text: string) {
    setCustomText(text);
    setCustomError("");
  }

  function addCustom() {
    const name = custom.trim();
    if (name.length < 2) return setCustomError("Please type the function's name");
    if (name.length > 40 || !NAME_TEXT.test(name))
      return setCustomError("Please use letters and numbers only (up to 40)");
    if (names.some((n) => n.toLowerCase() === name.toLowerCase()))
      return setCustomError("That function is already in the list");
    if (values.functions.length >= MAX_FUNCTIONS) return setCustomError(`Up to ${MAX_FUNCTIONS} functions`);
    setTouched(true);
    setCustomError("");
    setCustomText("");
    onChange({ functions: [...values.functions, { name, day: values.days }] });
  }

  function toggleAddition(addition: ModernAddition, on: boolean) {
    const additions = on ? [...values.additions, addition] : values.additions.filter((a) => a !== addition);
    const asFunction = ADDITION_FUNCTIONS[addition];
    if (!multiDay || !asFunction) return onChange({ additions });
    // A modern addition that is its own function is ticked or unticked with it.
    const without = values.functions.filter((f) => f.name !== asFunction.name);
    const functions = on
      ? [...without, { name: asFunction.name, day: additionDay(asFunction.day, values.days) }].slice(0, MAX_FUNCTIONS)
      : without;
    onChange({ additions, functions });
  }

  return {
    multiDay,
    names,
    custom,
    customError,
    setCustom,
    refresh,
    setTraditions,
    toggleFunction,
    moveFunction,
    addCustom,
    toggleAddition,
  };
}
