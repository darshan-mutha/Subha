"use client";

import { useState } from "react";
import {
  ADDITION_FUNCTIONS,
  ADDITION_LABELS,
  MAX_DAYS,
  MAX_FUNCTIONS,
  MODERN_ADDITIONS,
  MULTI_DAY_EVENT_TYPES,
  TRADITIONS,
  TRADITION_LABELS,
  additionDay,
  dayLabel,
  sameFunctions,
  suggestedFunctions,
  usualFunctions,
  type FunctionChoice,
  type ModernAddition,
  type Tradition,
} from "@/lib/traditions";

export interface TraditionValues {
  eventType: string;
  traditions: Tradition[];
  traditionOther: string;
  days: number;
  functions: FunctionChoice[];
  additions: ModernAddition[];
}

interface Props {
  id: string;
  values: TraditionValues;
  onChange: (next: Partial<Omit<TraditionValues, "eventType">>) => void;
  errors: Record<string, string>;
}

const NAME_OK = /^[\p{L}\p{M}\p{N}\s.,'&()\-/]+$/u;

export { suggestedFunctions };

/**
 * Tradition, days, functions and modern additions. For weddings the functions
 * are pre-filled from the families' traditions; the host ticks, moves and adds their own.
 */
export function TraditionPicker({ id, values, onChange, errors }: Props) {
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
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState("");
  const [ours, theirs = ""] = values.traditions;

  /** Re-suggests functions while the host has not changed them by hand. */
  function refresh(next: Partial<Omit<TraditionValues, "eventType">>) {
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
    const list = [first, second].filter(Boolean) as Tradition[];
    const unique = [...new Set(list)];
    refresh({ traditions: unique });
  }

  const suggested = multiDay ? usualFunctions(values.traditions, values.eventType) : [];
  const additionNames = values.additions.map((a) => ADDITION_FUNCTIONS[a]?.name).filter(Boolean) as string[];
  const names = [...new Set([...additionNames, ...suggested, ...values.functions.map((f) => f.name)])];
  const chosen = new Map(values.functions.map((f) => [f.name, f.day]));
  const dayOptions = Array.from({ length: values.days + 1 }, (_, d) => d);

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

  function addCustom() {
    const name = custom.trim();
    if (name.length < 2) return setCustomError("Please type the function's name");
    if (name.length > 40 || !NAME_OK.test(name))
      return setCustomError("Please use letters and numbers only (up to 40)");
    if (names.some((n) => n.toLowerCase() === name.toLowerCase()))
      return setCustomError("That function is already in the list");
    if (values.functions.length >= MAX_FUNCTIONS) return setCustomError(`Up to ${MAX_FUNCTIONS} functions`);
    setTouched(true);
    setCustomError("");
    setCustom("");
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

  const count = values.traditions.length + (multiDay ? values.additions.length : 0);

  return (
    <details className="field span-2 personal traditions" open={multiDay || count > 0}>
      <summary>
        {multiDay ? "Traditions & functions" : "Tradition"} <span className="muted small">(optional)</span>
        {count > 0 && <span className="badge">{count} chosen</span>}
      </summary>
      <p className="muted small">
        Every family does things a little differently. Shubā suggests what is usually done; you choose what fits yours.
      </p>

      <div className="grid">
        <div className="field">
          <label htmlFor={`${id}-tradition`}>{multiDay ? "Your family's tradition" : "Tradition or community"}</label>
          <select id={`${id}-tradition`} value={ours ?? ""} onChange={(e) => setTraditions(e.target.value, theirs)}>
            <option value="">Not set</option>
            {TRADITIONS.map((t) => (
              <option key={t} value={t}>
                {TRADITION_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        {multiDay && (
          <div className="field">
            <label htmlFor={`${id}-tradition2`}>The other family&apos;s tradition</label>
            <select
              id={`${id}-tradition2`}
              value={theirs}
              onChange={(e) => setTraditions(ours ?? "", e.target.value)}
              disabled={!ours}
            >
              <option value="">Same as ours</option>
              {TRADITIONS.filter((t) => t !== ours).map((t) => (
                <option key={t} value={t}>
                  {TRADITION_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        )}
        {values.traditions.includes("other") && (
          <div className="field span-2">
            <label htmlFor={`${id}-traditionOther`}>Which tradition?</label>
            <input
              id={`${id}-traditionOther`}
              type="text"
              maxLength={60}
              placeholder="e.g. Konkani, Kodava, Sindhi, Parsi"
              value={values.traditionOther}
              aria-invalid={errors.traditionOther ? true : undefined}
              aria-describedby={errors.traditionOther ? `${id}-traditionOther-error` : undefined}
              onChange={(e) => onChange({ traditionOther: e.target.value })}
            />
            {errors.traditionOther && (
              <p className="field-error" id={`${id}-traditionOther-error`}>
                {errors.traditionOther}
              </p>
            )}
          </div>
        )}
        {multiDay && (
          <div className="field">
            <label htmlFor={`${id}-days`}>How many days?</label>
            <select id={`${id}-days`} value={values.days} onChange={(e) => refresh({ days: Number(e.target.value) })}>
              {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? "1 day" : `${d} days`}
                </option>
              ))}
            </select>
            <p className="hint">The date above is the first day.</p>
          </div>
        )}
      </div>

      {multiDay && names.length > 0 && (
        <fieldset className="choice-group">
          <legend>Functions</legend>
          <p className="muted small" id={`${id}-fn-hint`}>
            Tick the ones you&apos;ll have and pick the day for each. Each gets its own guests, budget and checklist.
          </p>
          <ul className="fn-list">
            {names.map((name) => {
              const on = chosen.has(name);
              const slug = name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
              return (
                <li key={name} className={`fn-row${on ? " is-on" : ""}`}>
                  <label className="fn-check">
                    <input
                      type="checkbox"
                      checked={on}
                      aria-describedby={`${id}-fn-hint`}
                      onChange={(e) => toggleFunction(name, e.target.checked)}
                    />
                    {name}
                  </label>
                  {on && (
                    <select
                      className="fn-day"
                      aria-label={`Day for ${name}`}
                      id={`${id}-fn-${slug}`}
                      value={chosen.get(name)}
                      onChange={(e) => moveFunction(name, Number(e.target.value))}
                    >
                      {dayOptions.map((d) => (
                        <option key={d} value={d}>
                          {d === 0 ? "Before" : dayLabel(d)}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="fn-add">
            <label htmlFor={`${id}-fn-custom`} className="sr-only">
              Add your own function
            </label>
            <input
              id={`${id}-fn-custom`}
              type="text"
              maxLength={40}
              placeholder="Add your own"
              value={custom}
              aria-invalid={customError ? true : undefined}
              aria-describedby={customError ? `${id}-fn-custom-error` : undefined}
              onChange={(e) => {
                setCustom(e.target.value);
                setCustomError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" className="btn btn-small" onClick={addCustom}>
              Add
            </button>
          </div>
          {customError && (
            <p className="field-error" id={`${id}-fn-custom-error`}>
              {customError}
            </p>
          )}
          {errors.functions && <p className="field-error">{errors.functions}</p>}
        </fieldset>
      )}

      {multiDay && (
        <fieldset className="choice-group">
          <legend>Modern additions</legend>
          <div className="choices">
            {MODERN_ADDITIONS.map((a) => {
              const on = values.additions.includes(a);
              return (
                <label key={a} className={`choice${on ? " is-on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={(e) => toggleAddition(a, e.target.checked)} />
                  {ADDITION_LABELS[a]}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </details>
  );
}
