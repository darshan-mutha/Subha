"use client";

import {
  FOCUS_AREAS,
  FOCUS_LABELS,
  FOOD_LABELS,
  FOOD_PREFS,
  GUEST_NEEDS,
  GUEST_NEED_LABELS,
  MAX_FOCUS,
  type FoodPref,
} from "@/lib/schemas";
import type { FormValues } from "./formValues";
import type { ToggleChoice, UpdateField } from "./useEventFormState";

interface Props {
  id: string;
  values: FormValues;
  update: UpdateField;
  toggle: ToggleChoice;
}

/** The optional "Make it yours" section: what matters most, food and guest needs. */
export function PersonalSection({ id, values, update, toggle }: Props) {
  const personalCount = values.focus.length + values.guestNeeds.length + (values.food ? 1 : 0);
  return (
    <details className="field span-2 personal" open={personalCount > 0}>
      <summary>
        Make it yours <span className="muted small">(optional)</span>
        {personalCount > 0 && <span className="badge">{personalCount} chosen</span>}
      </summary>

      <fieldset className="choice-group">
        <legend>What matters most? Pick up to {MAX_FOCUS}</legend>
        <p className="muted small" id={`${id}-focus-hint`}>
          Shubā gives these more of the budget and protects them if money gets tight.
        </p>
        <div className="choices">
          {FOCUS_AREAS.map((area) => {
            const checked = values.focus.includes(area);
            const full = !checked && values.focus.length >= MAX_FOCUS;
            const order = values.focus.indexOf(area) + 1;
            return (
              <label key={area} className={`choice${checked ? " is-on" : ""}${full ? " is-off" : ""}`}>
                <input
                  type="checkbox"
                  name="focus"
                  value={area}
                  checked={checked}
                  disabled={full}
                  aria-describedby={`${id}-focus-hint`}
                  onChange={(e) => toggle("focus", area, e.target.checked)}
                />
                {checked && (
                  <span className="choice-order" aria-hidden="true">
                    {order}
                  </span>
                )}
                {FOCUS_LABELS[area]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor={`${id}-food`}>Food</label>
        <select
          id={`${id}-food`}
          name="food"
          value={values.food}
          onChange={(e) => update("food", e.target.value as FoodPref)}
        >
          {FOOD_PREFS.map((f) => (
            <option key={f || "none"} value={f}>
              {FOOD_LABELS[f]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="choice-group">
        <legend>Guest needs</legend>
        <p className="muted small" id={`${id}-needs-hint`}>
          Shubā adds these to the venue and caterer messages, the budget and the checklist.
        </p>
        <div className="choices">
          {GUEST_NEEDS.map((need) => {
            const checked = values.guestNeeds.includes(need);
            return (
              <label key={need} className={`choice${checked ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  name="guestNeeds"
                  value={need}
                  checked={checked}
                  aria-describedby={`${id}-needs-hint`}
                  onChange={(e) => toggle("guestNeeds", need, e.target.checked)}
                />
                {GUEST_NEED_LABELS[need]}
              </label>
            );
          })}
        </div>
      </fieldset>
    </details>
  );
}
