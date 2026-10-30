import type { Deal, Deals, VendorRef } from "@/lib/deals";
import type { EventInput, Plan } from "@/lib/schemas";

/** Everything the vendor cards need to manage quotes and bookings. */
export interface DealState {
  deals: Deals;
  input: EventInput;
  budget: Plan["budget"];
  vendors: VendorRef[];
  /** Saves one vendor's deal. May reject (e.g. offline); the card shows the error. */
  onDeal: (vendorId: string, deal: Deal) => Promise<void>;
  /** Ticks or unticks the vendor's "Book …" item, so progress stays in step. */
  onBooked: (vendorId: string, booked: boolean) => void;
}

/** Which part to show: "compare" (quotes) or "book" (booking, payments, agreement). */
export type DealPart = "compare" | "book";

/** The add-a-quote form's fields, as typed. */
export type QuoteDraft = { vendorName: string; phone: string; amount: string; includes: string };

/** An empty add-a-quote form. */
export const BLANK_QUOTE: QuoteDraft = { vendorName: "", phone: "", amount: "", includes: "" };
