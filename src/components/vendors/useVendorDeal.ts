"use client";

import { useState, type FormEvent } from "react";
import { formatINR } from "@/lib/budget";
import { ApiError, requestAgreement } from "@/lib/client";
import { QuoteSchema, bookedQuote, emptyDeal, newQuoteId, type Deal, type Quote, type VendorRef } from "@/lib/deals";
import { fieldErrors } from "@/lib/schemas";
import { BLANK_QUOTE, type DealPart, type DealState } from "./types";

/** Advance and agreement drafts that follow changes made by others on a shared plan. */
function useDealDrafts(deal: Deal) {
  const [advance, setAdvance] = useState(String(deal.advance || ""));
  const [agreement, setAgreement] = useState(deal.agreement);
  // Follow changes made by others on a shared plan (adjusting state during render, not in an effect).
  const [seen, setSeen] = useState({ advance: deal.advance, agreement: deal.agreement });
  if (seen.advance !== deal.advance || seen.agreement !== deal.agreement) {
    setSeen({ advance: deal.advance, agreement: deal.agreement });
    if (seen.advance !== deal.advance) setAdvance(String(deal.advance || ""));
    if (seen.agreement !== deal.agreement) setAgreement(deal.agreement);
  }
  return { advance, setAdvance, agreement, setAgreement };
}

interface PaperworkOptions {
  vendor: VendorRef;
  brief: string;
  state: DealState;
  deal: Deal;
  booked: Quote | null;
  drafts: ReturnType<typeof useDealDrafts>;
  save: (next: Deal, message: string) => Promise<boolean>;
  setError: (message: string) => void;
  setStatus: (message: string) => void;
}

/** Saving the advance and drafting, editing and saving the agreement for a booked vendor. */
function usePaperwork({ vendor, brief, state, deal, booked, drafts, save, setError, setStatus }: PaperworkOptions) {
  const [drafting, setDrafting] = useState(false);

  async function saveAdvance() {
    const value = Math.max(0, Math.round(Number(drafts.advance) || 0));
    if (!booked || value === deal.advance) return;
    if (value > booked.amount) {
      setError(`The advance can't be more than the agreed price of ${formatINR(booked.amount)}.`);
      return;
    }
    await save({ ...deal, advance: value }, "Advance saved");
  }

  async function draft() {
    if (!booked) return;
    setDrafting(true);
    setError("");
    setStatus("Drafting the agreement…");
    try {
      const result = await requestAgreement({
        input: state.input,
        vendor: { type: vendor.type, brief },
        quote: booked,
        advance: deal.advance,
      });
      drafts.setAgreement(result.text);
      await save(
        { ...deal, agreement: result.text },
        result.source === "ai" ? "Agreement drafted" : "Shubā was busy, so it used standard wording. Agreement ready.",
      );
    } catch (e) {
      setStatus("");
      setError(e instanceof ApiError ? e.message : "Could not draft the agreement. Please try again.");
    } finally {
      setDrafting(false);
    }
  }

  async function saveAgreement() {
    if (drafts.agreement === deal.agreement) return;
    await save({ ...deal, agreement: drafts.agreement }, "Agreement saved");
  }

  return { drafting, saveAdvance, draft, saveAgreement };
}

/** State and actions for one vendor's quotes, booking, advance and agreement. */
export function useVendorDeal(vendor: VendorRef, brief: string, state: DealState, onStep?: (part: DealPart) => void) {
  const deal = state.deals[vendor.id] ?? emptyDeal();
  const booked = bookedQuote(deal);

  const [form, setForm] = useState(BLANK_QUOTE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const drafts = useDealDrafts(deal);

  async function save(next: Deal, message: string) {
    setError("");
    try {
      await state.onDeal(vendor.id, next);
      setStatus(message);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save. Please try again.");
      return false;
    }
  }

  async function addQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = QuoteSchema.safeParse({ ...form, id: newQuoteId() });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    if (await save({ ...deal, quotes: [...deal.quotes, parsed.data] }, `Quote from ${parsed.data.vendorName} added`)) {
      setForm(BLANK_QUOTE);
      setAdding(false);
    }
  }

  async function book(quoteId: string) {
    const quote = deal.quotes.find((q) => q.id === quoteId);
    if (!quote) return;
    const ok = await save(
      { ...deal, booked: quoteId, advance: Math.min(deal.advance, quote.amount), agreement: "" },
      `${quote.vendorName} booked`,
    );
    if (ok) {
      state.onBooked(vendor.id, true);
      onStep?.("book");
    }
  }

  async function cancelBooking() {
    if (await save({ ...deal, booked: "", advance: 0, agreement: "" }, "Booking cancelled")) {
      state.onBooked(vendor.id, false);
    }
  }

  async function removeQuote(quoteId: string) {
    const isBooked = deal.booked === quoteId;
    const next = { ...deal, quotes: deal.quotes.filter((q) => q.id !== quoteId) };
    if (isBooked) Object.assign(next, { booked: "", advance: 0, agreement: "" });
    if ((await save(next, "Quote removed")) && isBooked) state.onBooked(vendor.id, false);
  }

  const paperwork = usePaperwork({ vendor, brief, state, deal, booked, drafts, save, setError, setStatus });

  return {
    deal,
    booked,
    form,
    setForm,
    errors,
    adding,
    setAdding,
    error,
    status,
    ...drafts,
    save,
    addQuote,
    book,
    cancelBooking,
    removeQuote,
    ...paperwork,
  };
}
