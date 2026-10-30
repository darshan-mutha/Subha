"use client";

import { MAX_AGREEMENT, type Quote } from "@/lib/deals";
import { CopyButton } from "../plan/CopyButton";
import { printAgreement, vendorWhatsApp } from "./vendorWhatsApp";

/** The editable agreement draft with Copy, WhatsApp and Print actions. */
export function AgreementBox({
  id,
  agreement,
  booked,
  onChange,
  onBlur,
}: {
  id: string;
  agreement: string;
  booked: Quote;
  onChange: (text: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="agreement" id={id}>
      <label htmlFor={`${id}-text`} className="small-heading">
        Agreement draft (you can edit it)
      </label>
      <textarea
        id={`${id}-text`}
        rows={14}
        maxLength={MAX_AGREEMENT}
        value={agreement}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <pre className="agreement-print" aria-hidden="true">
        {agreement}
      </pre>
      <p className="note small">A simple draft, not legal advice. Read it with the vendor before signing.</p>
      <div className="row no-print">
        <CopyButton text={agreement} label="agreement" />
        <a
          className="btn btn-small"
          href={vendorWhatsApp(booked.phone, agreement)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Send to {booked.vendorName} on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" className="btn btn-small" onClick={() => printAgreement(id)}>
          Download PDF / Print
        </button>
      </div>
    </div>
  );
}
