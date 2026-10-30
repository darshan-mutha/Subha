"use client";

import { suggestedFunctions, type FunctionChoice, type ModernAddition, type Tradition } from "@/lib/traditions";
import { FunctionsList } from "./traditions/FunctionsList";
import { ModernAdditions } from "./traditions/ModernAdditions";
import { TraditionFields } from "./traditions/TraditionFields";
import { useTraditionChoices } from "./traditions/useTraditionChoices";

export interface TraditionValues {
  eventType: string;
  traditions: Tradition[];
  traditionOther: string;
  days: number;
  functions: FunctionChoice[];
  additions: ModernAddition[];
}

interface Props {
  id: string;
  values: TraditionValues;
  onChange: (next: Partial<Omit<TraditionValues, "eventType">>) => void;
  errors: Record<string, string>;
}

export { suggestedFunctions };

/**
 * Tradition, days, functions and modern additions. For weddings the functions
 * are pre-filled from the families' traditions; the host ticks, moves and adds their own.
 */
export function TraditionPicker({ id, values, onChange, errors }: Props) {
  const choices = useTraditionChoices(values, onChange);
  const { multiDay, names } = choices;
  const count = values.traditions.length + (multiDay ? values.additions.length : 0);

  return (
    <details className="field span-2 personal traditions" open={multiDay || count > 0}>
      <summary>
        {multiDay ? "Traditions & functions" : "Tradition"} <span className="muted small">(optional)</span>
        {count > 0 && <span className="badge">{count} chosen</span>}
      </summary>
      <p className="muted small">
        Every family does things a little differently. Shubā suggests what is usually done; you choose what fits yours.
      </p>

      <TraditionFields
        id={id}
        values={values}
        multiDay={multiDay}
        errors={errors}
        setTraditions={choices.setTraditions}
        setTraditionOther={(traditionOther) => onChange({ traditionOther })}
        setDays={(days) => choices.refresh({ days })}
      />

      {multiDay && names.length > 0 && (
        <FunctionsList
          id={id}
          names={names}
          functions={values.functions}
          days={values.days}
          custom={choices.custom}
          customError={choices.customError}
          error={errors.functions}
          setCustom={choices.setCustom}
          addCustom={choices.addCustom}
          toggleFunction={choices.toggleFunction}
          moveFunction={choices.moveFunction}
        />
      )}

      {multiDay && <ModernAdditions additions={values.additions} toggleAddition={choices.toggleAddition} />}
    </details>
  );
}
