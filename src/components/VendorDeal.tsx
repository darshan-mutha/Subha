"use client";

import { useId } from "react";
import type { VendorRef } from "@/lib/deals";
import { BookingEmpty, BookingPart } from "./vendors/BookPart";
import { ComparePart } from "./vendors/ComparePart";
import type { DealPart, DealState } from "./vendors/types";
import { useVendorDeal } from "./vendors/useVendorDeal";

export type { DealPart, DealState } from "./vendors/types";
export { vendorWhatsApp } from "./vendors/vendorWhatsApp";

/** One vendor's quotes ("compare") or booking ("book"), with status and error messages. */
export function VendorDeal({
  vendor,
  brief,
  state,
  part,
  onStep,
}: {
  vendor: VendorRef;
  brief: string;
  state: DealState;
  part: DealPart;
  /** Moves the vendor screen to another step, e.g. to the booking after "Book". */
  onStep?: (part: DealPart) => void;
}) {
  const uid = useId();
  const ctl = useVendorDeal(vendor, brief, state, onStep);
  return (
    <div className="deal">
      {part === "compare" && <ComparePart uid={uid} vendor={vendor} state={state} ctl={ctl} />}
      {part === "book" && !ctl.booked && <BookingEmpty onStep={onStep} />}
      {part === "book" && ctl.booked && <BookingPart uid={uid} ctl={ctl} />}

      {ctl.error && (
        <p className="form-error small" role="alert">
          {ctl.error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {ctl.status}
      </p>
    </div>
  );
}
