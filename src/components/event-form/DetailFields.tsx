"use client";

import { LIMITS } from "@/lib/schemas";
import { FieldError, fieldAttrs, type FieldContext } from "./fieldHelpers";
import type { FormValues } from "./formValues";
import type { UpdateField } from "./useEventFormState";

interface Props {
  ctx: FieldContext;
  values: FormValues;
  update: UpdateField;
}

/** Style or theme input. */
export function StyleField({ ctx, values, update }: Props) {
  return (
    <div className="field span-2">
      <label htmlFor={`${ctx.id}-style`}>Style or theme</label>
      <input
        {...fieldAttrs(ctx, "style")}
        type="text"
        maxLength={60}
        placeholder="e.g. Traditional South Indian, minimal, Bollywood"
        value={values.style}
        onChange={(e) => update("style", e.target.value)}
      />
      <FieldError ctx={ctx} name="style" />
    </div>
  );
}

/** Free-text notes plus the auspicious timings checkbox. */
export function NotesAndMuhurat({ ctx, values, update, onMuhuratTouched }: Props & { onMuhuratTouched: () => void }) {
  const { id } = ctx;
  return (
    <>
      <div className="field span-2">
        <label htmlFor={`${id}-notes`}>Must-haves, things to avoid, anything else?</label>
        <textarea
          {...fieldAttrs(ctx, "notes")}
          rows={3}
          maxLength={LIMITS.maxNotes}
          placeholder="e.g. Live dosa counter is a must, no loud DJ, venue already booked…"
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
        />
        <FieldError ctx={ctx} name="notes" />
      </div>

      <div className="field span-2 checkbox">
        <input
          {...fieldAttrs(ctx, "includeMuhurat")}
          type="checkbox"
          checked={values.includeMuhurat}
          onChange={(e) => {
            onMuhuratTouched();
            update("includeMuhurat", e.target.checked);
          }}
        />
        <label htmlFor={`${id}-includeMuhurat`}>
          Show auspicious timings (Rahu Kalam, Yamagandam, Gulika Kalam) for the event day
        </label>
      </div>
    </>
  );
}
