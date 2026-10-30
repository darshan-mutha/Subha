"use client";

import type { FormEvent } from "react";
import type { QuoteDraft } from "./types";

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
      <div className="field">
        <label htmlFor={`${uid}-name`}>Vendor name</label>
        <input
          id={`${uid}-name`}
          type="text"
          value={form.vendorName}
          maxLength={60}
          aria-invalid={Boolean(errors.vendorName)}
          aria-describedby={errors.vendorName ? `${uid}-name-err` : undefined}
          onChange={(e) => onChange({ ...form, vendorName: e.target.value })}
        />
        {errors.vendorName && (
          <span id={`${uid}-name-err`} className="field-error">
            {errors.vendorName}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${uid}-amount`}>Quoted price (₹)</label>
        <input
          id={`${uid}-amount`}
          type="text"
          inputMode="numeric"
          value={form.amount}
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={errors.amount ? `${uid}-amount-err` : undefined}
          onChange={(e) => onChange({ ...form, amount: e.target.value.replace(/[^\d]/g, "") })}
        />
        {errors.amount && (
          <span id={`${uid}-amount-err`} className="field-error">
            {errors.amount}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${uid}-phone`}>Phone (optional)</label>
        <input
          id={`${uid}-phone`}
          type="tel"
          value={form.phone}
          maxLength={20}
          aria-invalid={Boolean(errors.phone)}
          onChange={(e) => onChange({ ...form, phone: e.target.value })}
        />
        {errors.phone && <span className="field-error">{errors.phone}</span>}
      </div>
      <div className="field field-wide">
        <label htmlFor={`${uid}-includes`}>What&apos;s included (optional)</label>
        <input
          id={`${uid}-includes`}
          type="text"
          value={form.includes}
          maxLength={300}
          placeholder="e.g. Veg buffet, 2 sweets, serving staff"
          aria-invalid={Boolean(errors.includes)}
          onChange={(e) => onChange({ ...form, includes: e.target.value })}
        />
        {errors.includes && <span className="field-error">{errors.includes}</span>}
      </div>
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
