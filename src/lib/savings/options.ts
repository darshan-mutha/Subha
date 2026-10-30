import { formatINR } from "../budget";
import { FOCUS_LABELS, LIMITS, type EventInput, type Plan } from "../schemas";
import { cleanInstruction, type OverLine, type SavingOption, type SavingsRequest } from "./schema";

/**
 * The choices worked out in code: which lines are over, raising the budget,
 * the change request behind each choice, and the plain fallback choices.
 */

/** Budget lines whose bookings cost more than the line allows. */
export function overLines(budget: Plan["budget"], booked: Map<string, number>): OverLine[] {
  return budget
    .map((line) => ({ category: line.category, over: Math.round((booked.get(line.category) ?? 0) - line.amount) }))
    .filter((l) => l.over > 0)
    .sort((a, b) => b.over - a.over);
}

export const totalOver = (lines: OverLine[]) => lines.reduce((sum, l) => sum + l.over, 0);

/** Rounds up to the next ₹1,000 so the new budget is a tidy number. */
const roundUp = (amount: number) => Math.ceil(amount / 1000) * 1000;

/** "Increase the budget": always offered when bookings are over. */
export function raiseBudgetOption(total: number, lines: OverLine[]): SavingOption | null {
  const over = totalOver(lines);
  if (over <= 0) return null;
  const extra = roundUp(over);
  return {
    kind: "raise-budget",
    title: `Increase the budget to ${formatINR(total + extra)}`,
    detail: `Add ${formatINR(extra)} so your bookings fit. ${lines
      .slice(0, 3)
      .map((l) => l.category)
      .join(", ")} get${lines.length === 1 ? "s" : ""} the extra money; nothing else changes.`,
    saving: extra,
    affects: `You spend ${formatINR(extra)} more in total.`,
    instruction: "",
  };
}

/**
 * Applies "Increase the budget" without AI: the total goes up and each
 * over-booked line gets exactly what it is short (the rounding goes to the
 * biggest one), so every booking fits and no other line moves.
 */
export function applyRaise(
  input: EventInput,
  budget: Plan["budget"],
  lines: OverLine[],
): { input: EventInput; budget: Plan["budget"]; changes: string[] } {
  const over = totalOver(lines);
  const extra = roundUp(over);
  const top = lines[0]?.category;
  const next = budget.map((line) => {
    const short = lines.find((l) => l.category === line.category)?.over ?? 0;
    const rounding = line.category === top ? extra - over : 0;
    return short > 0 ? { ...line, amount: line.amount + short + rounding } : line;
  });
  const newTotal = Math.min(LIMITS.maxBudget, input.budget + extra);
  return {
    input: { ...input, budget: newTotal },
    budget: next,
    changes: [
      `Total budget: ${formatINR(input.budget)} → ${formatINR(newTotal)}`,
      ...lines.map((l) => `${l.category}: +${formatINR(l.over + (l.category === top ? extra - over : 0))}`),
      "Other budget lines did not change.",
    ],
  };
}

/** Change requests sent when the host picks a choice. */
export function coverClause(request: Pick<SavingsRequest, "mode" | "need" | "overLines" | "input">): string {
  if (request.mode === "cut") {
    return `Lower the total budget by ${formatINR(request.need)} to ${formatINR(Math.max(LIMITS.minBudget, request.input.budget - request.need))}.`;
  }
  const where = request.overLines.length
    ? request.overLines.map((l) => l.category).join(", ")
    : "the over-booked lines";
  return `Keep the total budget the same and move the money saved to ${where}.`;
}

/** Adds the "where the money goes" clause, trimming the action first so the clause always fits. */
export function withTail(action: string, tail: string): string {
  const room = LIMITS.maxInstruction - tail.length - 1;
  return cleanInstruction(`${cleanInstruction(action).slice(0, room)} ${tail}`);
}

/** Used when the AI is unavailable, so the host still gets choices. */
export function standardOptions(request: SavingsRequest): SavingOption[] {
  const { input, budget, need } = request;
  const focus = input.focus.map((f) => FOCUS_LABELS[f].toLowerCase());
  const isPriority = (category: string) =>
    focus.some((f) => category.toLowerCase().includes(f.split(" ")[0])) ||
    (input.focus.includes("food") && /cater|food/i.test(category));
  const cuttable = budget.filter((l) => !isPriority(l.category) && l.amount > 0).sort((a, b) => b.amount - a.amount);
  const tail = coverClause(request);
  const out: SavingOption[] = [];

  const biggest = cuttable[0];
  if (biggest) {
    const saving = Math.min(need, Math.round((biggest.amount * 0.25) / 100) * 100);
    out.push({
      kind: "cheaper-options",
      title: `Simpler ${biggest.category.toLowerCase()}`,
      detail: `Choose a simpler option for ${biggest.category.toLowerCase()} and spend about a quarter less on it.`,
      saving,
      affects: `${biggest.category} will be simpler.`,
      instruction: cleanInstruction(
        `Spend about ${formatINR(saving)} less on ${biggest.category} by choosing simpler options. ${tail}`,
      ),
    });
  }

  const extras = cuttable.slice(1, 3);
  if (extras.length) {
    const saving = Math.min(need, Math.round(extras.reduce((s, l) => s + l.amount * 0.4, 0) / 100) * 100);
    const names = extras.map((l) => l.category).join(" and ");
    out.push({
      kind: "drop-extras",
      title: `Cut back on ${names.toLowerCase()}`,
      detail: `These matter least to you, so trim them first.`,
      saving,
      affects: `Less spent on ${names.toLowerCase()}.`,
      instruction: cleanInstruction(
        `Cut about ${formatINR(saving)} from ${names}, the areas that matter least. ${tail}`,
      ),
    });
  }

  const food = budget.find((l) => /cater|food/i.test(l.category));
  if (food && input.guests >= 20) {
    const cutGuests = Math.max(5, Math.round(input.guests * 0.1));
    const saving = Math.round(((food.amount / input.guests) * cutGuests) / 100) * 100;
    out.push({
      kind: "fewer-guests",
      title: `Invite ${cutGuests} fewer guests`,
      detail: `Bring the guest list from ${input.guests} to ${input.guests - cutGuests}. Food is paid per plate, so this saves straight away.`,
      saving,
      affects: `${cutGuests} fewer people at the event.`,
      instruction: cleanInstruction(
        `Reduce the guest count from ${input.guests} to ${input.guests - cutGuests} and lower food and other per-guest costs to match. ${tail}`,
      ),
    });
  }
  return out;
}
