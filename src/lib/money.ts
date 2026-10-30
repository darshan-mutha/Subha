/** Rupee amounts as people in India read them. */

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Formats a number as Indian Rupees, e.g. ₹12,50,000. */
export function formatINR(amount: number): string {
  return INR.format(Math.round(amount));
}

/** Short amounts for tight spaces: ₹45,000 · ₹7.2 L · ₹1.25 Cr. Exact amounts stay with formatINR. */
export function formatShortINR(amount: number): string {
  const n = Math.round(amount);
  const trim = (v: number, digits: number) => String(Math.round(v * 10 ** digits) / 10 ** digits);
  if (Math.abs(n) >= 10_000_000) return `₹${trim(n / 10_000_000, 2)} Cr`;
  if (Math.abs(n) >= 100_000) return `₹${trim(n / 100_000, 1)} L`;
  return formatINR(n);
}

/** Spelled-out Indian form for budget suggestions: ₹45,000 · ₹3.2 lakh · ₹1.25 crore. */
export function formatLakhCrore(amount: number): string {
  const trim = (n: number) => String(Number(n.toFixed(2)));
  if (amount >= 10_000_000) return `₹${trim(amount / 10_000_000)} crore`;
  if (amount >= 100_000) return `₹${trim(amount / 100_000)} lakh`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
