"use client";

import { formatINR } from "@/lib/budget";
import { AgreementBox } from "./AgreementBox";
import type { DealPart } from "./types";
import type { useVendorDeal } from "./useVendorDeal";

/** The "Book" step before anything is booked: a hint and a way back to the quotes. */
export function BookingEmpty({ onStep }: { onStep?: (part: DealPart) => void }) {
  return (
    <div className="booking-empty">
      <p className="muted small">
        Not booked yet. Compare the quotes and tap <strong>Book</strong> on the one you choose. The advance, balance and
        booking confirmation then show here.
      </p>
      {onStep && (
        <button type="button" className="btn btn-small" onClick={() => onStep("compare")}>
          Compare quotes
        </button>
      )}
    </div>
  );
}

/** The "Book" step once booked: advance, balance, agreement draft and cancel. */
export function BookingPart({ uid, ctl }: { uid: string; ctl: ReturnType<typeof useVendorDeal> }) {
  const { deal, booked } = ctl;
  if (!booked) return null;
  const agreementId = `${uid}-agreement`;
  const paid = Math.min(deal.advance, booked.amount);
  return (
    <div className="booking">
      <h3 className="small-heading">Booking</h3>
      <p>
        Booked <strong>{booked.vendorName}</strong> for <strong>{formatINR(booked.amount)}</strong>
      </p>
      <div className="row small no-print">
        <label htmlFor={`${uid}-advance`}>Advance paid (₹)</label>
        <input
          id={`${uid}-advance`}
          type="text"
          className="advance-input"
          inputMode="numeric"
          value={ctl.advance}
          onChange={(e) => ctl.setAdvance(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => void ctl.saveAdvance()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ctl.saveAdvance();
          }}
        />
      </div>
      <p className="small">
        Advance paid {formatINR(paid)} · Balance due <strong>{formatINR(booked.amount - paid)}</strong>
      </p>
      <div className="row no-print">
        <button
          type="button"
          className="btn btn-small btn-primary"
          onClick={() => void ctl.draft()}
          disabled={ctl.drafting}
        >
          {ctl.drafting ? "Drafting…" : deal.agreement ? "Redraft agreement" : "Draft agreement"}
        </button>
        <button type="button" className="btn btn-small btn-link" onClick={() => void ctl.cancelBooking()}>
          Cancel booking
        </button>
      </div>

      {(ctl.agreement || deal.agreement) && (
        <AgreementBox
          id={agreementId}
          agreement={ctl.agreement}
          booked={booked}
          onChange={ctl.setAgreement}
          onBlur={() => void ctl.saveAgreement()}
        />
      )}
    </div>
  );
}
