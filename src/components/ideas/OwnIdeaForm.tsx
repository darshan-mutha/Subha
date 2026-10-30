"use client";

import { useRef, useState, type FormEvent } from "react";
import { LEANINGS, LEANING_LABELS, type Leaning } from "@/lib/ideas/schema";
import { tidyText } from "@/lib/ideas/state";
import { invalidAttrs } from "../fieldErrors";
import { toggleIn } from "./toggleIn";
import type { Job } from "./useIdeasActions";

interface Props {
  id: string;
  own: string;
  setOwn: (value: string) => void;
  functions: string[];
  job: Job;
  onSubmit: (leanings: Leaning[], ownFunction: string) => void;
}

const NEED_SOMETHING = "Type your idea, or pick a starting point such as Budget-friendly.";

/** "Got an idea?": the host's own idea, starting points and which function it is for. */
export function OwnIdeaForm({ id, own, setOwn, functions, job, onSubmit }: Props) {
  const [leanings, setLeanings] = useState<Leaning[]>([]);
  const [ownFunction, setOwnFunction] = useState("");
  const [problem, setProblem] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const errorId = `${id}-own-error`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tidyText(own, 300).length < 3 && leanings.length === 0) {
      setProblem(NEED_SOMETHING);
      textRef.current?.focus();
      return;
    }
    setProblem("");
    onSubmit(leanings, ownFunction);
  }

  return (
    <section className="card-inner own-idea" aria-labelledby={`${id}-own`}>
      <h3 id={`${id}-own`}>Got an idea?</h3>
      <form onSubmit={submit}>
        <label htmlFor={`${id}-own-text`}>Something you&apos;ve seen, loved or must have. Shubā builds on it.</label>
        <textarea
          id={`${id}-own-text`}
          ref={textRef}
          rows={3}
          maxLength={300}
          placeholder="e.g. A mehendi with a garden feel, Rajasthani food stalls, something fun for the kids"
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          {...invalidAttrs(errorId, problem || undefined)}
        />
        {problem && (
          <p id={errorId} className="field-error" role="alert">
            {problem}
          </p>
        )}
        <div className="choices" role="group" aria-label="Starting points">
          {LEANINGS.map((l) => {
            const on = leanings.includes(l);
            return (
              <button
                key={l}
                type="button"
                className={`chip${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => setLeanings((list) => toggleIn(list, l, 3))}
              >
                {LEANING_LABELS[l]}
              </button>
            );
          })}
        </div>
        {functions.length > 0 && (
          <div className="field own-fn">
            <label htmlFor={`${id}-own-fn`}>For which function?</label>
            <select id={`${id}-own-fn`} value={ownFunction} onChange={(e) => setOwnFunction(e.target.value)}>
              <option value="">Any</option>
              {functions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn" disabled={job !== null}>
          {job === "more" ? "Thinking…" : "Get ideas"}
        </button>
      </form>
    </section>
  );
}
