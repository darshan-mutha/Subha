"use client";

import { EVENT_TYPES, EVENT_TYPE_LABELS, LIMITS, type EventType } from "@/lib/schemas";
import { FieldError, fieldAttrs, type FieldContext } from "./fieldHelpers";
import type { FormValues } from "./formValues";
import type { UpdateField } from "./useEventFormState";

interface Props {
  ctx: FieldContext;
  values: FormValues;
  update: UpdateField;
}

/** Event type, name, date, city and guest count. */
export function BasicFields({ ctx, values, update }: Props) {
  const { id } = ctx;
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-eventType`}>
          Event type <span aria-hidden="true">*</span>
        </label>
        <select
          {...fieldAttrs(ctx, "eventType")}
          required
          value={values.eventType}
          onChange={(e) => update("eventType", e.target.value as EventType)}
        >
          <option value="">Choose an event</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <FieldError ctx={ctx} name="eventType" />
      </div>

      <div className="field">
        <label htmlFor={`${id}-eventName`}>Event name</label>
        <input
          {...fieldAttrs(ctx, "eventName")}
          type="text"
          maxLength={80}
          placeholder="e.g. Aarav turns 5"
          value={values.eventName}
          onChange={(e) => update("eventName", e.target.value)}
        />
        <FieldError ctx={ctx} name="eventName" />
      </div>

      <div className="field">
        <label htmlFor={`${id}-date`}>
          Date <span aria-hidden="true">*</span>
        </label>
        <input
          {...fieldAttrs(ctx, "date")}
          type="date"
          required
          value={values.date}
          onChange={(e) => update("date", e.target.value)}
        />
        <FieldError ctx={ctx} name="date" />
      </div>

      <div className="field">
        <label htmlFor={`${id}-city`}>
          City <span aria-hidden="true">*</span>
        </label>
        <input
          {...fieldAttrs(ctx, "city")}
          type="text"
          required
          autoComplete="address-level2"
          maxLength={60}
          placeholder="e.g. Bengaluru"
          value={values.city}
          onChange={(e) => update("city", e.target.value)}
        />
        <FieldError ctx={ctx} name="city" />
      </div>

      <div className="field">
        <label htmlFor={`${id}-guests`}>
          Number of guests <span aria-hidden="true">*</span>
        </label>
        <input
          {...fieldAttrs(ctx, "guests")}
          type="number"
          inputMode="numeric"
          required
          min={LIMITS.minGuests}
          max={LIMITS.maxGuests}
          placeholder="e.g. 150"
          value={values.guests}
          onChange={(e) => update("guests", e.target.value)}
        />
        <FieldError ctx={ctx} name="guests" />
      </div>
    </>
  );
}
