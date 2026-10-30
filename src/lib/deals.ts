import { z } from "zod";
import { formatINR } from "./budget";
import type { Plan } from "./schemas";
import { localId } from "./ids";
import { ID } from "./ids";
import { MARKUP_CHARS, nameField, NO_MARKUP, phoneField, SAFE_TEXT } from "./validation";

/* ------------------------------------------------------------------ */
/* Vendor quotes, booking and payments. Worked out in code, not by AI, */
/* so the numbers the host sees are always their own.                  */
/* ------------------------------------------------------------------ */

export const MAX_QUOTES = 5;
export const MAX_AGREEMENT = 4000;
const MAX_AMOUNT = 1_000_000_000;

const QuoteId = z.string().regex(ID.quote);

export const QuoteSchema = z.object({
  id: QuoteId,
  vendorName: nameField(60, {
    empty: "Please enter the vendor's name",
    invalid: "Name contains characters that are not allowed",
  }),
  phone: phoneField(),
  amount: z.coerce
    .number({ message: "Please enter the quoted amount" })
    .min(1, "Please enter the quoted amount")
    .max(MAX_AMOUNT, "Amount is too large"),
  includes: z
    .string()
    .trim()
    .max(300, "Please keep this under 300 characters")
    .regex(SAFE_TEXT, "This contains characters that are not allowed")
    .default(""),
});

export type Quote = z.infer<typeof QuoteSchema>;

export const DealSchema = z
  .object({
    quotes: z.array(QuoteSchema).max(MAX_QUOTES, `Up to ${MAX_QUOTES} quotes per vendor`).default([]),
    /** The quote the host booked, or "" when nothing is booked yet. */
    booked: z.union([QuoteId, z.literal("")]).default(""),
    advance: z.coerce.number().min(0).max(MAX_AMOUNT).default(0),
    /** Budget line this vendor is paid from. "" means "work it out from the vendor type". */
    budgetCategory: z.string().trim().max(60).default(""),
    agreement: z
      .string()
      .max(MAX_AGREEMENT, "The agreement is too long")
      // Agreement text is free-form, but never markup or code.
      .regex(NO_MARKUP, "The agreement contains characters that are not allowed")
      .default(""),
  })
  .refine((d) => !d.booked || d.quotes.some((q) => q.id === d.booked), {
    message: "Booked quote not found",
    path: ["booked"],
  });

export type Deal = z.infer<typeof DealSchema>;

const VendorItemId = z.string().regex(ID.vendorItem);
export const DealsSchema = z.record(VendorItemId, DealSchema);
export type Deals = z.infer<typeof DealsSchema>;

export const emptyDeal = (): Deal => ({ quotes: [], booked: "", advance: 0, budgetCategory: "", agreement: "" });

export function newQuoteId(): string {
  return localId("q");
}

/** Removes deals for vendors that are no longer in the plan. */
export function pruneDeals(deals: Deals | undefined, vendorIds: string[]): Deals {
  const keep = new Set(vendorIds);
  return Object.fromEntries(Object.entries(deals ?? {}).filter(([id]) => keep.has(id)));
}

/** Strips characters the agreement field does not accept (used on AI output). */
export function cleanAgreementText(text: string): string {
  return text.replace(MARKUP_CHARS, "").slice(0, MAX_AGREEMENT);
}

/* ------------------------------------------------------------------ */
/* Matching a vendor to the budget line that pays for it.              */
/* ------------------------------------------------------------------ */

const GROUPS: string[][] = [
  ["cater", "food", "meal", "dinner", "lunch", "buffet", "chef", "sweet", "cake", "baker", "halwai", "snack"],
  ["decor", "flower", "florist", "mandap", "light", "tent", "stage", "balloon", "rangoli"],
  ["photo", "video", "camera", "film", "cinemat"],
  ["venue", "hall", "banquet", "lawn", "resort", "location"],
  ["music", "dj", "band", "sound", "entertain", "artist", "nadaswaram", "anchor", "emcee", "magician", "perform"],
  ["makeup", "mehendi", "mehndi", "beauty", "salon", "bridal", "hair", "attire", "outfit", "cloth"],
  ["priest", "pandit", "pooja", "puja", "ritual", "purohit"],
  ["invit", "card", "print", "stationery"],
  ["transport", "car", "cab", "bus", "travel", "logistic"],
  ["gift", "favour", "favor"],
  ["rental", "furniture", "chair"],
];

const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];

function groupsOf(text: string): Set<number> {
  const found = new Set<number>();
  for (const word of words(text)) {
    GROUPS.forEach((keys, i) => {
      if (keys.some((k) => (k.length <= 3 ? word === k : word.startsWith(k)))) found.add(i);
    });
  }
  return found;
}

/** Finds the budget line most likely to pay for a vendor, e.g. "Caterer" → "Food & catering". */
export function matchBudgetLine(vendorType: string, budget: Plan["budget"]): string {
  const vendorWords = new Set(words(vendorType).filter((w) => w.length > 3));
  const direct = budget.find((line) => words(line.category).some((w) => vendorWords.has(w)));
  if (direct) return direct.category;
  const groups = groupsOf(vendorType);
  const byGroup = budget.find((line) => [...groupsOf(line.category)].some((g) => groups.has(g)));
  return byGroup?.category ?? "";
}

/* ------------------------------------------------------------------ */
/* Summaries.                                                          */
/* ------------------------------------------------------------------ */

export interface VendorRef {
  id: string;
  type: string;
}

export function bookedQuote(deal: Deal | undefined): Quote | null {
  if (!deal?.booked) return null;
  return deal.quotes.find((q) => q.id === deal.booked) ?? null;
}

export function lineFor(vendor: VendorRef, deal: Deal | undefined, budget: Plan["budget"]): string {
  const chosen = deal?.budgetCategory;
  if (chosen && budget.some((l) => l.category === chosen)) return chosen;
  return matchBudgetLine(vendor.type, budget);
}

/** Booked amounts per budget line. */
export function bookedByLine(vendors: VendorRef[], deals: Deals, budget: Plan["budget"]): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of vendors) {
    const quote = bookedQuote(deals[v.id]);
    if (!quote) continue;
    const line = lineFor(v, deals[v.id], budget) || "Other";
    out.set(line, (out.get(line) ?? 0) + quote.amount);
  }
  return out;
}

/**
 * How much of its budget line is left for this vendor: the line's amount
 * minus what other vendors on the same line have already booked.
 */
export function budgetForVendor(
  vendor: VendorRef,
  vendors: VendorRef[],
  deals: Deals,
  budget: Plan["budget"],
): { line: string; planned: number; usedByOthers: number; available: number } | null {
  const line = lineFor(vendor, deals[vendor.id], budget);
  const planned = budget.find((l) => l.category === line)?.amount;
  if (!line || planned === undefined) return null;
  const usedByOthers = vendors
    .filter((v) => v.id !== vendor.id && lineFor(v, deals[v.id], budget) === line)
    .reduce((sum, v) => sum + (bookedQuote(deals[v.id])?.amount ?? 0), 0);
  return { line, planned, usedByOthers, available: Math.max(0, planned - usedByOthers) };
}

export type QuoteVerdict = { kind: "under" | "over" | "on"; difference: number; text: string };

/** Compares a quote with the money available for that vendor. */
export function judgeQuote(amount: number, available: number): QuoteVerdict {
  const difference = Math.round(amount - available);
  if (Math.abs(difference) <= Math.max(500, available * 0.02)) {
    return { kind: "on", difference, text: "Fits the budget" };
  }
  return difference > 0
    ? { kind: "over", difference, text: `${formatINR(difference)} over budget` }
    : { kind: "under", difference, text: `${formatINR(-difference)} under budget` };
}

export interface PaymentSummary {
  bookedCount: number;
  committed: number;
  advancePaid: number;
  balanceDue: number;
}

export function paymentSummary(vendors: VendorRef[], deals: Deals): PaymentSummary {
  let bookedCount = 0;
  let committed = 0;
  let advancePaid = 0;
  for (const v of vendors) {
    const deal = deals[v.id];
    const quote = bookedQuote(deal);
    if (!quote || !deal) continue;
    bookedCount++;
    committed += quote.amount;
    advancePaid += Math.min(deal.advance, quote.amount);
  }
  return { bookedCount, committed, advancePaid, balanceDue: committed - advancePaid };
}

/** Quotes sorted cheapest first, for the comparison table. */
export function sortedQuotes(deal: Deal | undefined): Quote[] {
  return [...(deal?.quotes ?? [])].sort((a, b) => a.amount - b.amount);
}
