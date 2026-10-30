"use client";

import { useRef, useState } from "react";
import { BudgetHelper } from "@/components/BudgetHelper";
import { formatINR } from "@/lib/budget";
import { perGuest, type BudgetOption } from "@/lib/budgetGuide";
import { formatLakhCrore } from "@/lib/money";
import { LIMITS } from "@/lib/schemas";
import { FieldError, fieldAttrs, type FieldContext } from "./fieldHelpers";
import type { FormValues } from "./formValues";
import type { UpdateField } from "./useEventFormState";

interface Props {
  ctx: FieldContext;
  values: FormValues;
  update: UpdateField;
}

/** Total budget with a per-guest hint and the "Help me decide" budget helper. */
export function BudgetField({ ctx, values, update }: Props) {
  const { id } = ctx;
  const [helperOpen, setHelperOpen] = useState(false);
  const [budgetNote, setBudgetNote] = useState("");
  const budgetRef = useRef<HTMLInputElement>(null);
  const helpToggleRef = useRef<HTMLButtonElement>(null);
  const each = perGuest(Number(values.budget), Number(values.guests));

  function pickBudget(option: BudgetOption) {
    update("budget", String(option.suggested));
    setBudgetNote(`${option.label} budget of ${formatLakhCrore(option.suggested)} added. You can change it any time.`);
    setHelperOpen(false);
    budgetRef.current?.focus();
  }

  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-budget`}>
          Total budget (₹) <span aria-hidden="true">*</span>
        </label>
        <input
          {...fieldAttrs(ctx, "budget")}
          ref={budgetRef}
          type="number"
          inputMode="numeric"
          required
          min={LIMITS.minBudget}
          step={1000}
          placeholder="e.g. 500000"
          value={values.budget}
          onChange={(e) => {
            setBudgetNote("");
            update("budget", e.target.value);
          }}
        />
        <FieldError ctx={ctx} name="budget" />
        {each !== null && !ctx.errors.budget && <p className="hint per-guest">About {formatINR(each)} per guest</p>}
        <p className="sr-only" role="status">
          {budgetNote}
        </p>
        <button
          type="button"
          ref={helpToggleRef}
          className="btn btn-link btn-small budget-help-toggle"
          aria-expanded={helperOpen}
          aria-controls={`${id}-budget-helper`}
          onClick={() => setHelperOpen((o) => !o)}
        >
          Not sure? Help me decide
        </button>
      </div>

      {helperOpen && (
        <div className="span-2">
          <BudgetHelper
            id={`${id}-budget-helper`}
            eventType={values.eventType}
            guests={values.guests}
            city={values.city}
            current={values.budget}
            onPick={pickBudget}
            onClose={() => {
              setHelperOpen(false);
              helpToggleRef.current?.focus();
            }}
          />
        </div>
      )}
    </>
  );
}
