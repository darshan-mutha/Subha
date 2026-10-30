"use client";

import { dayLabel, type FunctionChoice } from "@/lib/traditions";

interface Props {
  id: string;
  names: string[];
  functions: FunctionChoice[];
  days: number;
  custom: string;
  customError: string;
  error: string | undefined;
  setCustom: (text: string) => void;
  addCustom: () => void;
  toggleFunction: (name: string, on: boolean) => void;
  moveFunction: (name: string, day: number) => void;
}

/** The functions to tick, each with its day, plus a box to add the host's own. */
export function FunctionsList({
  id,
  names,
  functions,
  days,
  custom,
  customError,
  error,
  setCustom,
  addCustom,
  toggleFunction,
  moveFunction,
}: Props) {
  const chosen = new Map(functions.map((f) => [f.name, f.day]));
  const dayOptions = Array.from({ length: days + 1 }, (_, d) => d);
  return (
    <fieldset className="choice-group" aria-describedby={error ? `${id}-fn-error` : undefined}>
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
                  aria-describedby={error ? `${id}-fn-hint ${id}-fn-error` : `${id}-fn-hint`}
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
      <CustomFunction id={id} custom={custom} customError={customError} setCustom={setCustom} addCustom={addCustom} />
      {error && (
        <p className="field-error" id={`${id}-fn-error`}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** A box to add the host's own function (Enter adds it), with its error linked. */
function CustomFunction({
  id,
  custom,
  customError,
  setCustom,
  addCustom,
}: Pick<Props, "id" | "custom" | "customError" | "setCustom" | "addCustom">) {
  return (
    <>
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
          onChange={(e) => setCustom(e.target.value)}
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
    </>
  );
}
