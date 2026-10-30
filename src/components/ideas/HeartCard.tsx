"use client";

import type { Dispatch, SetStateAction } from "react";
import { FEELINGS, FEELING_LABELS, type Feeling } from "@/lib/ideas";
import type { Plan } from "@/lib/schemas";
import { Dots } from "./Dots";
import { toggleIn } from "./toggleIn";
import type { Job } from "./useIdeasActions";

interface Props {
  id: string;
  eventName: string;
  forWhom: string;
  setForWhom: (value: string) => void;
  feelings: Feeling[];
  setFeelings: Dispatch<SetStateAction<Feeling[]>>;
  theme: Plan["theme"];
  colors: { name: string; hex: string }[];
  job: Job;
  hasDirections: boolean;
  onShowThemes: () => void;
}

/** The heart of the celebration: who it is for, how guests should feel, the current theme and the themes button. */
export function HeartCard({
  id,
  eventName,
  forWhom,
  setForWhom,
  feelings,
  setFeelings,
  theme,
  colors,
  job,
  hasDirections,
  onShowThemes,
}: Props) {
  return (
    <section className="card-inner heart" aria-labelledby={`${id}-heart`}>
      <h3 id={`${id}-heart`}>The heart of your celebration</h3>
      <div className="field">
        <label htmlFor={`${id}-for`}>Who is it really for?</label>
        <input
          id={`${id}-for`}
          type="text"
          maxLength={80}
          placeholder={eventName ? `e.g. ${eventName}` : "e.g. Dadi's 80th, our daughter's first birthday"}
          value={forWhom}
          onChange={(e) => setForWhom(e.target.value)}
        />
      </div>
      <fieldset className="choice-group">
        <legend>How should guests feel? Pick up to 3</legend>
        <div className="choices">
          {FEELINGS.map((f) => {
            const on = feelings.includes(f);
            return (
              <label key={f} className={`choice${on ? " is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && feelings.length >= 3}
                  onChange={() => setFeelings((list) => toggleIn(list, f, 3))}
                />
                {FEELING_LABELS[f]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="theme-now">
        <p>
          <span className="muted">Your theme now:</span> <strong>{theme.name}</strong>
        </p>
        <p className="small">{theme.description}</p>
        <Dots colors={colors} />
      </div>
      <button type="button" className="btn btn-primary" onClick={onShowThemes} disabled={job !== null}>
        {job === "themes" ? "Sketching themes…" : hasDirections ? "Show me 3 new themes" : "Show me 3 theme ideas"}
      </button>
    </section>
  );
}
