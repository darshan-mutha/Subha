"use client";

import { ADDITION_LABELS, MODERN_ADDITIONS, type ModernAddition } from "@/lib/traditions";

interface Props {
  additions: ModernAddition[];
  toggleAddition: (addition: ModernAddition, on: boolean) => void;
}

/** Checkboxes for modern additions such as choreography or a welcome party. */
export function ModernAdditions({ additions, toggleAddition }: Props) {
  return (
    <fieldset className="choice-group">
      <legend>Modern additions</legend>
      <div className="choices">
        {MODERN_ADDITIONS.map((a) => {
          const on = additions.includes(a);
          return (
            <label key={a} className={`choice${on ? " is-on" : ""}`}>
              <input type="checkbox" checked={on} onChange={(e) => toggleAddition(a, e.target.checked)} />
              {ADDITION_LABELS[a]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
