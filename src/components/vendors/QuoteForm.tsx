"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import type { QuoteDraft } from "./types";

/** One labelled quote input whose error (when shown) is linked to it with aria-describedby. */
function QuoteField({
  id,
  label,
  error,
  wide = false,
  ...input
}: {
  id: string;
  label: string;
  error: string | undefined;
  wide?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-invalid" | "aria-describedby">) {
  return (
    <div className={wide ? "field field-wide" : "field"}>
      <label htmlFor={id}>{label}</label>
      <input id={id} {...input} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} />
      {error && (
        <span id={`${id}-err`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}

/** The add-a-quote form: vendor name, price, phone and what's included. */
export function QuoteForm({
  uid,
  form,
  errors,
  onChange,
  onSubmit,
  onCancel,
}: {
  uid: string;
  form: QuoteDraft;
  errors: Record<string, string>;
  onChange: (form: QuoteDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="quote-form no-print" onSubmit={onSubmit} noValidate>
      <QuoteField
        id={`${uid}-name`}
        label="Vendor name"
        error={errors.vendorName}
        type="text"
        value={form.vendorName}
        maxLength={60}
        onChange={(e) => onChange({ ...form, vendorName: e.target.value })}
      />
      <QuoteField
        id={`${uid}-amount`}
        label="Quoted price (₹)"
        error={errors.amount}
        type="text"
        inputMode="numeric"
        value={form.amount}
        onChange={(e) => onChange({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })}
      />
      <QuoteField
        id={`${uid}-phone`}
        label="Phone (optional)"
        error={errors.phone}
        type="tel"
        value={form.phone}
        maxLength={20}
        onChange={(e) => onChange({ ...form, phone: e.target.value })}
      />
      <QuoteField
        id={`${uid}-includes`}
        label="What's included (optional)"
        error={errors.includes}
        wide
        type="text"
        value={form.includes}
        maxLength={300}
        placeholder="e.g. Veg buffet, 2 sweets, serving staff"
        onChange={(e) => onChange({ ...form, includes: e.target.value })}
      />
      <div className="row">
        <button type="submit" className="btn btn-primary btn-small">
          Add quote
        </button>
        <button type="button" className="btn btn-link btn-small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
