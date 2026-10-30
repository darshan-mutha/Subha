import { formatINR, formatShortINR } from "./budget";
import { bookedQuote, lineFor, paymentSummary, sortedQuotes, type Deals, type PaymentSummary } from "./deals";
import type { ScheduledItem } from "./schedule";
import type { Plan } from "./schemas";
import type { Done } from "./team";

/**
 * The summary at the top of the Vendors section, worked out in code from the
 * plan, the quotes and the bookings: how many vendors are needed, booked,
 * getting quotes and not started, the money, and which one to book next.
 */

export type VendorStage = "booked" | "quotes" | "not-started";
export const VENDOR_FILTERS = ["all", "not-started", "quotes", "booked", "overdue"] as const;
export type VendorFilter = (typeof VENDOR_FILTERS)[number];
export const FILTER_LABELS: Record<VendorFilter, string> = {
  all: "All",
  "not-started": "Not started",
  quotes: "Getting quotes",
  booked: "Booked",
  overdue: "Overdue",
};

export interface VendorRow {
  id: string;
  type: string;
  mustHave: boolean;
  stage: VendorStage;
  /** Not booked and past its book-by date. */
  overdue: boolean;
  due: string;
  quotes: number;
  cheapest: number | null;
  bookedAmount: number | null;
  /** Advance paid on the booked quote. */
  advance: number;
}

export interface VendorSummary {
  rows: VendorRow[];
  needed: number;
  mustHave: number;
  niceToHave: number;
  booked: VendorRow[];
  gettingQuotes: VendorRow[];
  notStarted: VendorRow[];
  overdue: VendorRow[];
  /** All quotes received, for every vendor. */
  quotesIn: number;
  /** Quotes for vendors not booked yet: the ones still being compared. */
  quotesToCompare: number;
  /** The budget lines that pay for vendors, added up. */
  vendorBudget: number;
  payments: PaymentSummary;
  /** The unbooked vendor to book first: overdue, then soonest, then must-have. */
  next: VendorRow | null;
}

export function vendorSummary(items: ScheduledItem[], plan: Plan, deals: Deals, done: Done): VendorSummary {
  const rows: VendorRow[] = items.map((item, i) => {
    const vendor = plan.vendors[i];
    const deal = deals[item.id];
    const quote = bookedQuote(deal);
    const isBooked = Boolean(done[item.id]) || Boolean(quote);
    const quotes = deal?.quotes.length ?? 0;
    return {
      id: item.id,
      type: vendor?.type ?? item.label,
      mustHave: vendor?.priority === "must-have",
      stage: isBooked ? "booked" : quotes > 0 ? "quotes" : "not-started",
      overdue: !isBooked && item.status === "overdue",
      due: item.due,
      quotes,
      cheapest: sortedQuotes(deal)[0]?.amount ?? null,
      bookedAmount: quote?.amount ?? null,
      advance: quote ? Math.min(deal?.advance ?? 0, quote.amount) : 0,
    };
  });

  const refs = rows.map((r) => ({ id: r.id, type: r.type }));
  const lines = new Set(refs.map((v) => lineFor(v, deals[v.id], plan.budget)).filter(Boolean));
  const vendorBudget = plan.budget.filter((l) => lines.has(l.category)).reduce((s, l) => s + l.amount, 0);

  const open = rows.filter((r) => r.stage !== "booked");
  const next =
    [...open].sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) || a.due.localeCompare(b.due) || Number(b.mustHave) - Number(a.mustHave),
    )[0] ?? null;

  return {
    rows,
    needed: rows.length,
    mustHave: rows.filter((r) => r.mustHave).length,
    niceToHave: rows.filter((r) => !r.mustHave).length,
    booked: rows.filter((r) => r.stage === "booked"),
    gettingQuotes: rows.filter((r) => r.stage === "quotes"),
    notStarted: rows.filter((r) => r.stage === "not-started"),
    overdue: rows.filter((r) => r.overdue),
    quotesIn: rows.reduce((s, r) => s + r.quotes, 0),
    quotesToCompare: open.reduce((s, r) => s + r.quotes, 0),
    vendorBudget,
    payments: paymentSummary(refs, deals),
    next,
  };
}

/** "Venue (heritage haveli or lawn)" → "Venue": the name without the details in brackets. */
export function shortName(type: string): string {
  const short = type.split(/\s*[(:–—]/u)[0].trim();
  return short || type;
}

export function matchesFilter(row: VendorRow, filter: VendorFilter): boolean {
  if (filter === "all") return true;
  if (filter === "overdue") return row.overdue;
  return row.stage === filter;
}

export function filterCount(summary: VendorSummary, filter: VendorFilter): number {
  return summary.rows.filter((r) => matchesFilter(r, filter)).length;
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
};

/** Days between two ISO dates (to − from). */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The short tag on each vendor card, e.g. "Overdue · 3 quotes", "Booked · ₹2,90,000". */
export function stageTag(row: VendorRow): { text: string; tone: "ok" | "bad" | "info" } {
  if (row.stage === "booked") {
    return { text: row.bookedAmount ? `Booked · ${formatINR(row.bookedAmount)}` : "Booked", tone: "ok" };
  }
  const quotes = row.quotes ? `${row.quotes} quote${row.quotes === 1 ? "" : "s"}` : "Not started";
  if (row.overdue) return { text: `Overdue · ${quotes}`, tone: "bad" };
  return { text: `${quotes} · by ${shortDate(row.due)}`, tone: "info" };
}

/** "Book next" line, e.g. "Caterer — by 14 Nov (overdue by 2 days). 3 quotes in; cheapest ₹4,20,000." */
export function nextLine(row: VendorRow, today: string): string {
  const late = daysBetween(row.due, today);
  const when = row.overdue
    ? `by ${shortDate(row.due)} (overdue by ${late} day${late === 1 ? "" : "s"})`
    : row.due === today
      ? "by today"
      : `by ${shortDate(row.due)}`;
  const quotes = row.quotes
    ? ` ${row.quotes} quote${row.quotes === 1 ? "" : "s"} in; cheapest ${formatINR(row.cheapest ?? 0)}.`
    : " No quotes yet: send the ready-made message to a few vendors.";
  return `${shortName(row.type)} — ${when}.${quotes}`;
}

/** "To book" (most urgent first) and "Booked": the two groups on the Vendors screen. */
export function vendorGroups(rows: VendorRow[]): { toBook: VendorRow[]; booked: VendorRow[] } {
  const toBook = rows
    .filter((r) => r.stage !== "booked")
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) || a.due.localeCompare(b.due) || Number(b.mustHave) - Number(a.mustHave),
    );
  const booked = rows.filter((r) => r.stage === "booked").sort((a, b) => a.due.localeCompare(b.due));
  return { toBook, booked };
}

/** The coloured label on a vendor row. Text always says the status; colour only helps. */
export function rowStatus(row: VendorRow): { text: string; tone: "late" | "quotes" | "new" | "ok" } {
  if (row.stage === "booked") return { text: "Booked", tone: "ok" };
  if (row.overdue) return { text: "Overdue", tone: "late" };
  if (row.stage === "quotes") return { text: "Quotes in", tone: "quotes" };
  return { text: "Not started", tone: "new" };
}

/** The short line under a vendor's name, e.g. "2 quotes · lowest ₹7.2 L" or "₹6 L · ₹4 L due". */
export function rowDetail(row: VendorRow): string {
  if (row.stage === "booked") {
    if (!row.bookedAmount) return "Marked as booked";
    const due = row.bookedAmount - row.advance;
    return `${formatShortINR(row.bookedAmount)} · ${due > 0 ? `${formatShortINR(due)} due` : "paid"}`;
  }
  if (row.quotes > 0) {
    const n = `${row.quotes} quote${row.quotes === 1 ? "" : "s"}`;
    return row.quotes === 1
      ? `${n} · ${formatShortINR(row.cheapest ?? 0)}`
      : `${n} · lowest ${formatShortINR(row.cheapest ?? 0)}`;
  }
  return `${row.overdue ? "Was due" : "Book by"} ${shortDate(row.due)}`;
}

/** Which step a vendor is on: ask vendors for quotes, compare them, or the booking. */
export type VendorStep = "ask" | "compare" | "book";
export function currentStep(row: VendorRow): VendorStep {
  return row.stage === "booked" ? "book" : row.stage === "quotes" ? "compare" : "ask";
}

const ICONS: [RegExp, string][] = [
  [/venue|hall|haveli|lawn|banquet|resort|farm/i, "🏛️"],
  [/cater|food|chef|cook|halwai|dessert|cake|bak/i, "🍛"],
  [/decor|flower|florist|mandap|tent|light/i, "🌸"],
  [/photo|video|film|camera/i, "📷"],
  [/music|dj|sound|band|dhol|singer|entertain|dance|choreo/i, "🎶"],
  [/makeup|mua|hair|beauty|stylist/i, "💄"],
  [/mehendi|mehndi|henna/i, "🌿"],
  [/pandit|priest|qazi|granthi|pujari|purohit|officiant/i, "🪔"],
  [/invit|card|print/i, "💌"],
  [/transport|car|bus|travel|baraat|horse|ghodi/i, "🚗"],
  [/stay|hotel|room|accommodation/i, "🛏️"],
  [/gift|favour|favor|return/i, "🎁"],
  [/anchor|host|emcee|mc\b/i, "🎤"],
];
/** A friendly picture for each kind of vendor. Decorative only. */
export function vendorIcon(type: string): string {
  return ICONS.find(([re]) => re.test(type))?.[1] ?? "🤝";
}
