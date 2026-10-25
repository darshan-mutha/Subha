import { describe, expect, it } from "vitest";
import {
  DealSchema,
  DealsSchema,
  QuoteSchema,
  bookedByLine,
  bookedQuote,
  budgetForVendor,
  cleanAgreementText,
  emptyDeal,
  judgeQuote,
  matchBudgetLine,
  newQuoteId,
  paymentSummary,
  pruneDeals,
  sortedQuotes,
  type Deal,
} from "@/lib/deals";
import { makeSharedContentSchema } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

const budget = [
  { category: "Venue", amount: 300000, note: "" },
  { category: "Food & catering", amount: 400000, note: "" },
  { category: "Decor & flowers", amount: 150000, note: "" },
  { category: "Photography", amount: 100000, note: "" },
  { category: "Music & entertainment", amount: 50000, note: "" },
];

const quote = (id: string, vendorName: string, amount: number) => ({
  id,
  vendorName,
  phone: "",
  amount,
  includes: "",
});

const deal = (over: Partial<Deal> = {}): Deal => ({ ...emptyDeal(), ...over });

describe("matchBudgetLine", () => {
  it("matches by a shared word", () => {
    expect(matchBudgetLine("Photography & video", budget)).toBe("Photography");
    expect(matchBudgetLine("Venue / banquet hall", budget)).toBe("Venue");
  });

  it("matches by meaning when words differ", () => {
    expect(matchBudgetLine("Caterer", budget)).toBe("Food & catering");
    expect(matchBudgetLine("Florist", budget)).toBe("Decor & flowers");
    expect(matchBudgetLine("Photographer", budget)).toBe("Photography");
    expect(matchBudgetLine("DJ", budget)).toBe("Music & entertainment");
    expect(matchBudgetLine("Mandap decorator", budget)).toBe("Decor & flowers");
  });

  it("returns an empty string when nothing fits", () => {
    expect(matchBudgetLine("Pandit", budget)).toBe("");
  });

  it("matches the sample plan's vendors", () => {
    expect(matchBudgetLine("Caterer", samplePlan.budget)).toBe("Food");
    expect(matchBudgetLine("Entertainer", samplePlan.budget)).toBe("Entertainment");
  });
});

describe("budget comparison", () => {
  const vendors = [
    { id: "v_cater", type: "Caterer" },
    { id: "v_decor", type: "Decorator" },
    { id: "v_flower", type: "Florist" },
  ];

  it("gives a vendor its whole line when nothing else is booked", () => {
    expect(budgetForVendor(vendors[0], vendors, {}, budget)).toEqual({
      line: "Food & catering",
      planned: 400000,
      usedByOthers: 0,
      available: 400000,
    });
  });

  it("takes off what other vendors on the same line have booked", () => {
    const deals = {
      v_decor: deal({ quotes: [quote("qa", "Shree Decor", 100000)], booked: "qa" }),
    };
    const forFlorist = budgetForVendor(vendors[2], vendors, deals, budget);
    expect(forFlorist?.usedByOthers).toBe(100000);
    expect(forFlorist?.available).toBe(50000);
  });

  it("uses the line the host chose", () => {
    const deals = { v_cater: deal({ budgetCategory: "Venue" }) };
    expect(budgetForVendor(vendors[0], vendors, deals, budget)?.line).toBe("Venue");
  });

  it("ignores a chosen line that no longer exists", () => {
    const deals = { v_cater: deal({ budgetCategory: "Gone" }) };
    expect(budgetForVendor(vendors[0], vendors, deals, budget)?.line).toBe("Food & catering");
  });

  it("returns null when no line matches", () => {
    expect(budgetForVendor({ id: "v_x", type: "Pandit" }, vendors, {}, budget)).toBeNull();
  });

  it("judges quotes as over, under or on budget", () => {
    expect(judgeQuote(120000, 100000)).toMatchObject({ kind: "over", difference: 20000, text: "₹20,000 over budget" });
    expect(judgeQuote(80000, 100000)).toMatchObject({ kind: "under", text: "₹20,000 under budget" });
    expect(judgeQuote(101000, 100000)).toMatchObject({ kind: "on", text: "Fits the budget" });
    expect(judgeQuote(400, 0).kind).toBe("on");
  });
});

describe("payments", () => {
  const vendors = [
    { id: "v_cater", type: "Caterer" },
    { id: "v_photo", type: "Photographer" },
    { id: "v_dj", type: "Pandit" },
  ];
  const deals = {
    v_cater: deal({
      quotes: [quote("qa", "Annapoorna", 380000), quote("qb", "Udupi Caterers", 420000)],
      booked: "qa",
      advance: 100000,
    }),
    v_photo: deal({ quotes: [quote("qc", "Lens Story", 90000)] }),
    v_dj: deal({ quotes: [quote("qd", "Sharma ji", 21000)], booked: "qd", advance: 50000 }),
  };

  it("adds up booked vendors, advances and balance", () => {
    expect(paymentSummary(vendors, deals)).toEqual({
      bookedCount: 2,
      committed: 401000,
      // An advance is never counted above the agreed price.
      advancePaid: 121000,
      balanceDue: 280000,
    });
  });

  it("groups bookings by budget line, with unmatched ones under Other", () => {
    const lines = bookedByLine(vendors, deals, budget);
    expect(lines.get("Food & catering")).toBe(380000);
    expect(lines.get("Other")).toBe(21000);
    expect(lines.has("Photography")).toBe(false);
  });

  it("finds the booked quote and sorts quotes cheapest first", () => {
    expect(bookedQuote(deals.v_cater)?.vendorName).toBe("Annapoorna");
    expect(bookedQuote(deals.v_photo)).toBeNull();
    expect(bookedQuote(undefined)).toBeNull();
    expect(sortedQuotes(deals.v_cater).map((q) => q.amount)).toEqual([380000, 420000]);
    expect(sortedQuotes(undefined)).toEqual([]);
  });
});

describe("validation", () => {
  it("accepts a normal quote and coerces the amount", () => {
    const parsed = QuoteSchema.parse({ id: newQuoteId(), vendorName: "Annapoorna Caterers", amount: "380000" });
    expect(parsed.amount).toBe(380000);
    expect(parsed.phone).toBe("");
  });

  it("rejects bad quotes", () => {
    expect(QuoteSchema.safeParse({ id: "qa", vendorName: "", amount: 10 }).success).toBe(false);
    expect(QuoteSchema.safeParse({ id: "qa", vendorName: "<script>", amount: 10 }).success).toBe(false);
    expect(QuoteSchema.safeParse({ id: "qa", vendorName: "A", amount: 0 }).success).toBe(false);
    expect(QuoteSchema.safeParse({ id: "qa", vendorName: "A", amount: 10, phone: "call me" }).success).toBe(false);
    expect(QuoteSchema.safeParse({ id: "bad", vendorName: "A", amount: 10 }).success).toBe(false);
  });

  it("rejects a booking that points at a missing quote, too many quotes, or markup in agreements", () => {
    expect(DealSchema.safeParse({ booked: "qzz" }).success).toBe(false);
    const six = Array.from({ length: 6 }, (_, i) => quote(`q${i}`, "A", 10));
    expect(DealSchema.safeParse({ quotes: six }).success).toBe(false);
    expect(DealSchema.safeParse({ agreement: "<b>hi</b>" }).success).toBe(false);
    expect(DealsSchema.safeParse({ t_abc: {} }).success).toBe(false);
  });

  it("is part of the shared plan, and older plans without deals still load", () => {
    const schema = makeSharedContentSchema();
    const base = { input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {} };
    expect(schema.parse(base).deals).toEqual({});
    const withDeal = schema.parse({ ...base, deals: { v_abc: { quotes: [quote("qa", "A", 100)], booked: "qa" } } });
    expect(withDeal.deals.v_abc.booked).toBe("qa");
  });

  it("prunes deals for vendors no longer in the plan", () => {
    expect(pruneDeals({ v_a: emptyDeal(), v_b: emptyDeal() }, ["v_b"])).toEqual({ v_b: emptyDeal() });
    expect(pruneDeals(undefined, ["v_b"])).toEqual({});
  });

  it("cleans agreement text", () => {
    expect(cleanAgreementText("Hi <b>{x}</b> `y`\\")).toBe("Hi bx/b y");
    expect(cleanAgreementText("a".repeat(5000))).toHaveLength(4000);
  });
});
