"use client";

import { useId, useRef, type FormEvent } from "react";
import { TraditionPicker } from "@/components/TraditionPicker";
import {
  TRADITIONAL_EVENT_TYPES,
  fieldErrors,
  makeEventInputSchema,
  type EventInput,
  type EventType,
} from "@/lib/schemas";
import { BasicFields } from "./event-form/BasicFields";
import { BudgetField } from "./event-form/BudgetField";
import { NotesAndMuhurat, StyleField } from "./event-form/DetailFields";
import { PersonalSection } from "./event-form/PersonalSection";
import { EMPTY_FORM, EXAMPLES, toInput, type FormValues } from "./event-form/formValues";
import { useEventFormState } from "./event-form/useEventFormState";

export { EMPTY_FORM, EXAMPLES, fromInput, toInput, type FormValues } from "./event-form/formValues";

interface Props {
  initial?: FormValues;
  /** Messages to show on fields from the start, e.g. details a voice note did not cover. */
  initialErrors?: Record<string, string>;
  busy: boolean;
  serverErrors?: Record<string, string>;
  onSubmit: (input: EventInput) => void;
}

/** The event details form: checks every field before handing a valid event to `onSubmit`. */
export function EventForm({ initial = EMPTY_FORM, initialErrors = {}, busy, serverErrors = {}, onSubmit }: Props) {
  const form = useEventFormState(initial, initialErrors);
  const { values, errors, update } = form;
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const allErrors = { ...serverErrors, ...errors };
  const ctx = { id, errors: allErrors };
  const errorCount = Object.keys(allErrors).length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = makeEventInputSchema().safeParse(toInput(values));
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      form.setErrors(found);
      // Form controls can be looked up by id within the form.
      const first = formRef.current?.elements.namedItem(`${id}-${Object.keys(found)[0]}`);
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    form.setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <form ref={formRef} className="card event-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <div className="examples" role="group" aria-label="Try an example">
        <span className="examples-label">Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" className="chip" onClick={() => form.loadExample(ex.values)}>
            {ex.label}
          </button>
        ))}
      </div>

      {errorCount > 0 && (
        <p className="form-error" role="alert">
          Please fix {errorCount === 1 ? "1 field" : `${errorCount} fields`} below.
        </p>
      )}

      <div className="grid">
        <BasicFields ctx={ctx} values={values} update={update} />
        <BudgetField ctx={ctx} values={values} update={update} />
        <StyleField ctx={ctx} values={values} update={update} />

        {(values.eventType === "wedding" || TRADITIONAL_EVENT_TYPES.has(values.eventType as EventType)) && (
          <TraditionPicker
            id={`${id}-tr`}
            values={{ ...values, eventType: values.eventType }}
            errors={allErrors}
            onChange={(next) => form.setValues((v) => ({ ...v, ...next }))}
          />
        )}

        <PersonalSection id={id} values={values} update={update} toggle={form.toggle} />
        <NotesAndMuhurat
          ctx={ctx}
          values={values}
          update={update}
          onMuhuratTouched={() => form.setMuhuratTouched(true)}
        />
      </div>

      <p className="hint">
        <span aria-hidden="true">*</span> Required
      </p>

      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? "Creating your plan…" : "Create my plan"}
      </button>
    </form>
  );
}
