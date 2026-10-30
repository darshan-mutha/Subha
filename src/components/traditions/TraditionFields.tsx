"use client";

import { MAX_DAYS, TRADITIONS, TRADITION_LABELS } from "@/lib/traditions";
import type { TraditionValues } from "../TraditionPicker";

interface Props {
  id: string;
  values: TraditionValues;
  multiDay: boolean;
  errors: Record<string, string>;
  setTraditions: (first: string, second: string) => void;
  setTraditionOther: (text: string) => void;
  setDays: (days: number) => void;
}

/** The tradition selects (ours, theirs, "other") and, for multi-day events, the number of days. */
export function TraditionFields({ id, values, multiDay, errors, setTraditions, setTraditionOther, setDays }: Props) {
  const [ours, theirs = ""] = values.traditions;
  return (
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
            onChange={(e) => setTraditionOther(e.target.value)}
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
          <select id={`${id}-days`} value={values.days} onChange={(e) => setDays(Number(e.target.value))}>
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
  );
}
