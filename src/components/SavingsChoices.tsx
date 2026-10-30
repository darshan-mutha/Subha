"use client";

import { useId, useState, type FormEvent } from "react";
import { formatINR } from "@/lib/budget";
import { ApiError, requestSavings } from "@/lib/client";
import { SAVING_KIND_LABELS, totalOver, type OverLine, type SavingOption, type SavingsRequest } from "@/lib/savings";
import { LIMITS, type EventInput, type Plan } from "@/lib/schemas";

interface Props {
  input: EventInput;
  plan: Plan;
  /** Budget lines whose bookings cost more than planned. */
  over: OverLine[];
  /** Busy with another change (a choice being applied, or a plan update). */
  busy: boolean;
  /** Applies the chosen option. Resolves true when the plan was updated. */
  onChoose: (option: SavingOption, request: SavingsRequest) => Promise<boolean>;
}

/** The amount check, the request to Shubā and the chosen option, for one savings panel. */
function useSavings({ input, plan, over, onChoose }: Omit<Props, "busy">) {
  const overBy = totalOver(over);
  const [amount, setAmount] = useState("");
  const [options, setOptions] = useState<SavingOption[] | null>(null);
  const [source, setSource] = useState<"ai" | "standard">("ai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [request, setRequest] = useState<SavingsRequest | null>(null);

  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const need = overBy > 0 ? overBy : Number(amount.replace(/[^\d]/g, ""));
    if (!Number.isFinite(need) || need < 100) {
      setError("Please enter how much you need to save, at least ₹100.");
      return;
    }
    if (overBy === 0 && need >= input.budget) {
      setError(`That is more than your whole budget of ${formatINR(input.budget)}.`);
      return;
    }
    const body: SavingsRequest = {
      input,
      budget: plan.budget,
      vendors: plan.vendors.map((v) => v.type).slice(0, 10),
      mode: overBy > 0 ? "cover" : "cut",
      need: Math.min(need, LIMITS.maxBudget),
      overLines: over,
    };
    setLoading(true);
    setError("");
    setOptions(null);
    try {
      const reply = await requestSavings(body);
      setOptions(reply.options);
      setSource(reply.source);
      setRequest(body);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function choose(option: SavingOption) {
    if (!request) return;
    const ok = await onChoose(option, request);
    if (ok) {
      setOptions(null);
      setAmount("");
    }
  }

  return { overBy, amount, setAmount, options, source, loading, error, find, choose };
}

/** The heading and the line explaining why the host might want to save. */
function SavingsIntro({ id, overBy, over }: { id: string; overBy: number; over: OverLine[] }) {
  return (
    <>
      <h3 id={`${id}-title`} tabIndex={-1} data-savings-heading>
        {overBy > 0 ? "Over budget? See your choices" : "Need to spend less?"}
      </h3>
      {overBy > 0 ? (
        <p>
          <span className="status-label over-budget">
            <span aria-hidden="true">⚠ </span>Over by {formatINR(overBy)}
          </span>{" "}
          Your bookings cost more than planned for {over.map((l) => `${l.category} (${formatINR(l.over)})`).join(", ")}.
          Pick how you want to make it fit.
        </p>
      ) : (
        <p className="muted">
          Tell Shubā how much you need to save, and it shows you a few different ways to do it. You choose.
        </p>
      )}
    </>
  );
}

/** The ways to save Shubā found, each with its saving, what it affects and a Choose button. */
function SavingsOptions({
  options,
  source,
  working,
  onChoose,
}: {
  options: SavingOption[];
  source: "ai" | "standard";
  working: boolean;
  onChoose: (option: SavingOption) => void;
}) {
  return (
    <>
      <p className="small muted" role="status">
        {options.length} choices. Savings are estimates.
        {source === "standard" && " Shubā's AI is busy, so these are standard suggestions."} Choosing one updates your
        plan, and you can undo it.
      </p>
      <ul className="savings-options" role="list">
        {options.map((option) => (
          <li key={`${option.kind}-${option.title}`} className={`savings-option kind-${option.kind}`}>
            <p className="chip-label">{SAVING_KIND_LABELS[option.kind]}</p>
            <h4>{option.title}</h4>
            <p className="small">{option.detail}</p>
            <p className="savings-amount">
              {option.kind === "raise-budget"
                ? `Adds ${formatINR(option.saving)}`
                : `Saves about ${formatINR(option.saving)}`}
            </p>
            <p className="small muted">
              <span className="sr-only">What it affects: </span>
              {option.affects}
            </p>
            <button
              type="button"
              className="btn btn-small"
              disabled={working}
              onClick={() => onChoose(option)}
              aria-label={`Choose: ${option.title}`}
            >
              Choose this
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Budget tab panel: "Over budget? See your choices." Offers several different
 * ways to save (or to raise the budget), each with an estimated saving and what
 * it affects, and lets the host pick one.
 */
export function SavingsChoices({ input, plan, over, busy, onChoose }: Props) {
  const id = useId();
  const { overBy, amount, setAmount, options, source, loading, error, find, choose } = useSavings({
    input,
    plan,
    over,
    onChoose,
  });
  const working = loading || busy;

  return (
    <section className={`savings card-inner${overBy > 0 ? " is-over" : ""}`} aria-labelledby={`${id}-title`}>
      <SavingsIntro id={id} overBy={overBy} over={over} />

      <form className="savings-form no-print" onSubmit={find} noValidate>
        {overBy === 0 && (
          <div className="field">
            <label htmlFor={`${id}-amount`}>How much do you need to save?</label>
            <input
              id={`${id}-amount`}
              type="text"
              inputMode="numeric"
              placeholder="e.g. 50000"
              value={amount}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={working}>
          {loading ? "Finding ways to save…" : options ? "Show other choices" : "Show my choices"}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
      {loading && (
        <p className="loading" role="status">
          <span className="spinner" aria-hidden="true" /> Finding ways to save… this takes about 10–20 seconds.
        </p>
      )}

      {options && (
        <SavingsOptions options={options} source={source} working={working} onChoose={(o) => void choose(o)} />
      )}
    </section>
  );
}
