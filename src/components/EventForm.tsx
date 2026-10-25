"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { BudgetHelper } from "@/components/BudgetHelper";
import { formatINR } from "@/lib/budget";
import { formatShortINR, perGuest, type BudgetOption } from "@/lib/budgetGuide";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  LIMITS,
  TRADITIONAL_EVENT_TYPES,
  fieldErrors,
  makeEventInputSchema,
  type EventInput,
  type EventType,
} from "@/lib/schemas";

export interface FormValues {
  eventType: EventType | "";
  eventName: string;
  date: string;
  city: string;
  guests: string;
  budget: string;
  style: string;
  notes: string;
  includeMuhurat: boolean;
}

export const EMPTY_FORM: FormValues = {
  eventType: "",
  eventName: "",
  date: "",
  city: "",
  guests: "",
  budget: "",
  style: "",
  notes: "",
  includeMuhurat: false,
};

function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export const EXAMPLES: { label: string; values: FormValues }[] = [
  {
    label: "Wedding in Jaipur",
    values: {
      eventType: "wedding",
      eventName: "Ananya & Rohan's wedding",
      date: daysFromNow(120),
      city: "Jaipur",
      guests: "250",
      budget: "1500000",
      style: "Royal Rajasthani",
      notes: "Mostly vegetarian guests, some need Jain food",
      includeMuhurat: true,
    },
  },
  {
    label: "Kid's birthday",
    values: {
      eventType: "birthday",
      eventName: "Aarav turns 5",
      date: daysFromNow(30),
      city: "Bengaluru",
      guests: "40",
      budget: "50000",
      style: "Jungle safari",
      notes: "Afternoon party at home, 20 kids and 20 adults",
      includeMuhurat: false,
    },
  },
  {
    label: "Community Diwali",
    values: {
      eventType: "community-event",
      eventName: "Apartment Diwali Mela",
      date: daysFromNow(45),
      city: "Pune",
      guests: "300",
      budget: "200000",
      style: "Eco-friendly, no firecrackers",
      notes: "Stalls by residents, cultural programme for kids",
      includeMuhurat: false,
    },
  },
];

export function toInput(values: FormValues): unknown {
  return {
    ...values,
    guests: values.guests === "" ? undefined : values.guests,
    budget: values.budget === "" ? undefined : values.budget,
  };
}

export function fromInput(input: EventInput): FormValues {
  return {
    ...input,
    guests: String(input.guests),
    budget: String(input.budget),
  };
}

interface Props {
  initial?: FormValues;
  /** Messages to show on fields from the start, e.g. details a voice note did not cover. */
  initialErrors?: Record<string, string>;
  busy: boolean;
  serverErrors?: Record<string, string>;
  onSubmit: (input: EventInput) => void;
}

export function EventForm({ initial = EMPTY_FORM, initialErrors = {}, busy, serverErrors = {}, onSubmit }: Props) {
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [muhuratTouched, setMuhuratTouched] = useState(initial !== EMPTY_FORM);
  const [helperOpen, setHelperOpen] = useState(false);
  const [budgetNote, setBudgetNote] = useState("");
  const id = useId();
  const budgetRef = useRef<HTMLInputElement>(null);
  const helpToggleRef = useRef<HTMLButtonElement>(null);
  const each = perGuest(Number(values.budget), Number(values.guests));

  function pickBudget(option: BudgetOption) {
    update("budget", String(option.suggested));
    setBudgetNote(`${option.label} budget of ${formatShortINR(option.suggested)} added. You can change it any time.`);
    setHelperOpen(false);
    budgetRef.current?.focus();
  }
  const allErrors = { ...serverErrors, ...errors };

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
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
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = makeEventInputSchema().safeParse(toInput(values));
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      const first = Object.keys(found)[0];
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  const field = (name: keyof FormValues) => ({
    id: `${id}-${name}`,
    name,
    "aria-invalid": allErrors[name] ? true : undefined,
    "aria-describedby": allErrors[name] ? `${id}-${name}-error` : undefined,
  });

  const errorText = (name: keyof FormValues) =>
    allErrors[name] ? (
      <p className="field-error" id={`${id}-${name}-error`}>
        {allErrors[name]}
      </p>
    ) : null;

  const errorCount = Object.keys(allErrors).length;

  return (
    <form className="card event-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <div className="examples" role="group" aria-label="Try an example">
        <span className="examples-label">Try an example:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="chip"
            onClick={() => {
              setValues(ex.values);
              setErrors({});
              setMuhuratTouched(false);
            }}
          >
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
        <div className="field">
          <label htmlFor={`${id}-eventType`}>
            Event type <span aria-hidden="true">*</span>
          </label>
          <select
            {...field("eventType")}
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
          {errorText("eventType")}
        </div>

        <div className="field">
          <label htmlFor={`${id}-eventName`}>Event name</label>
          <input
            {...field("eventName")}
            type="text"
            maxLength={80}
            placeholder="e.g. Aarav turns 5"
            value={values.eventName}
            onChange={(e) => update("eventName", e.target.value)}
          />
          {errorText("eventName")}
        </div>

        <div className="field">
          <label htmlFor={`${id}-date`}>
            Date <span aria-hidden="true">*</span>
          </label>
          <input
            {...field("date")}
            type="date"
            required
            value={values.date}
            onChange={(e) => update("date", e.target.value)}
          />
          {errorText("date")}
        </div>

        <div className="field">
          <label htmlFor={`${id}-city`}>
            City <span aria-hidden="true">*</span>
          </label>
          <input
            {...field("city")}
            type="text"
            required
            autoComplete="address-level2"
            maxLength={60}
            placeholder="e.g. Bengaluru"
            value={values.city}
            onChange={(e) => update("city", e.target.value)}
          />
          {errorText("city")}
        </div>

        <div className="field">
          <label htmlFor={`${id}-guests`}>
            Number of guests <span aria-hidden="true">*</span>
          </label>
          <input
            {...field("guests")}
            type="number"
            inputMode="numeric"
            required
            min={LIMITS.minGuests}
            max={LIMITS.maxGuests}
            placeholder="e.g. 150"
            value={values.guests}
            onChange={(e) => update("guests", e.target.value)}
          />
          {errorText("guests")}
        </div>

        <div className="field">
          <label htmlFor={`${id}-budget`}>
            Total budget (₹) <span aria-hidden="true">*</span>
          </label>
          <input
            {...field("budget")}
            ref={budgetRef}
            type="number"
            inputMode="numeric"
            required
            min={LIMITS.minBudget}
            step={1000}
            placeholder="e.g. 500000"
            value={values.budget}
            onChange={(e) => {
              setBudgetNote("");
              update("budget", e.target.value);
            }}
          />
          {errorText("budget")}
          {each !== null && !allErrors.budget && <p className="hint per-guest">About {formatINR(each)} per guest</p>}
          <p className="sr-only" role="status">
            {budgetNote}
          </p>
          <button
            type="button"
            ref={helpToggleRef}
            className="btn btn-link btn-small budget-help-toggle"
            aria-expanded={helperOpen}
            aria-controls={`${id}-budget-helper`}
            onClick={() => setHelperOpen((o) => !o)}
          >
            Not sure? Help me decide
          </button>
        </div>

        {helperOpen && (
          <div className="span-2">
            <BudgetHelper
              id={`${id}-budget-helper`}
              eventType={values.eventType}
              guests={values.guests}
              city={values.city}
              current={values.budget}
              onPick={pickBudget}
              onClose={() => {
                setHelperOpen(false);
                helpToggleRef.current?.focus();
              }}
            />
          </div>
        )}

        <div className="field span-2">
          <label htmlFor={`${id}-style`}>Style or theme</label>
          <input
            {...field("style")}
            type="text"
            maxLength={60}
            placeholder="e.g. Traditional South Indian, minimal, Bollywood"
            value={values.style}
            onChange={(e) => update("style", e.target.value)}
          />
          {errorText("style")}
        </div>

        <div className="field span-2">
          <label htmlFor={`${id}-notes`}>Anything else we should know?</label>
          <textarea
            {...field("notes")}
            rows={3}
            maxLength={LIMITS.maxNotes}
            placeholder="Food preferences, venue already booked, special guests…"
            value={values.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
          {errorText("notes")}
        </div>

        <div className="field span-2 checkbox">
          <input
            {...field("includeMuhurat")}
            type="checkbox"
            checked={values.includeMuhurat}
            onChange={(e) => {
              setMuhuratTouched(true);
              update("includeMuhurat", e.target.checked);
            }}
          />
          <label htmlFor={`${id}-includeMuhurat`}>
            Show auspicious timings (Rahu Kalam, Yamagandam, Gulika Kalam) for the event day
          </label>
        </div>
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
