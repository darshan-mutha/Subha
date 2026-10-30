"use client";

import type { FormEvent } from "react";
import type { EventInput, Plan } from "@/lib/schemas";
import { FOCUS_LABELS, FOOD_LABELS, GUEST_NEED_LABELS, LIMITS } from "@/lib/schemas";
import type { Member } from "@/lib/team";
import { TRADITION_LABELS } from "@/lib/traditions";
import { PetalMark } from "../Brand";
import { CopyButton } from "./CopyButton";

const REFINE_SUGGESTIONS = [
  "We added 50 guests, the budget is 10% lower and the date moved 2 weeks earlier",
  "Reduce the budget by 20%",
  "Move the event 1 week later",
  "Make it eco-friendly",
];

/** The plan summary and the facts it is shaped around (traditions, focus, food, guest needs). */
export function PlanAbout({ input, plan }: { input: EventInput; plan: Plan }) {
  return (
    <section className="plan-about" aria-labelledby="about-heading">
      <h2 id="about-heading" className="sr-only">
        About this plan
      </h2>
      <p className="summary">{plan.summary}</p>
      {(input.focus?.length > 0 || input.food || input.guestNeeds?.length > 0 || input.traditions?.length > 0) && (
        <ul className="personal-facts" aria-label="What this plan is shaped around">
          {input.traditions?.length > 0 && (
            <li>
              {input.traditions
                .map((t) => (t === "other" ? input.traditionOther || "Other" : TRADITION_LABELS[t]))
                .join(" & ")}
            </li>
          )}
          {input.focus?.length > 0 && <li>Matters most: {input.focus.map((f) => FOCUS_LABELS[f]).join(", ")}</li>}
          {input.food && <li>Food: {FOOD_LABELS[input.food]}</li>}
          {input.guestNeeds?.map((g) => (
            <li key={g}>{GUEST_NEED_LABELS[g]}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The plan's warnings, if any. */
export function PlanWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <section className="warnings" aria-labelledby="warn-heading">
      <h2 id="warn-heading" className="small-heading">
        Things to watch out for
      </h2>
      <ul>
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </section>
  );
}

/** "Show tasks for": filters tasks to one team member. */
export function ViewerPicker({
  team,
  viewer,
  onViewerChange,
}: {
  team: Member[];
  viewer: string;
  onViewerChange: (memberId: string) => void;
}) {
  if (team.length === 0) return null;
  return (
    <div className="viewer no-print">
      <label htmlFor="viewer">Show tasks for</label>
      <select id="viewer" value={viewer} onChange={(e) => onViewerChange(e.target.value)}>
        <option value="">Everyone</option>
        {team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Shown on Home once every task is done. */
export function CelebrateCard({
  title,
  shareUrl,
  onShare,
}: {
  title: string;
  shareUrl: string | null;
  /** Creates the team link, or null when sharing is not possible. */
  onShare: (() => void) | null;
}) {
  return (
    <section className="card celebrate" aria-labelledby="celebrate-heading">
      <PetalMark size={72} filled={5} />
      <h2 id="celebrate-heading">All set for {title}!</h2>
      <p className="muted">Every task is done. Enjoy the celebration.</p>
      <div className="row no-print">
        {shareUrl ? (
          <CopyButton text={shareUrl} label="team link" />
        ) : (
          onShare && (
            <button type="button" className="btn" onClick={onShare}>
              Share with my team
            </button>
          )
        )}
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Download PDF
        </button>
      </div>
    </section>
  );
}

/** "Change your plan": a plain-words change request with suggestions. */
export function RefineBox({
  busy,
  instruction,
  onInstruction,
  onSubmit,
}: {
  busy: boolean;
  instruction: string;
  onInstruction: (text: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="refine no-print" aria-labelledby="refine-heading">
      <h2 id="refine-heading" className="section-title">
        Change your plan
      </h2>
      <p className="muted">
        Plans change. Tell Shubā in your own words, such as more guests, a smaller budget or a new date, and it updates
        the whole plan without starting over.
      </p>
      <form onSubmit={onSubmit} className="refine-form" aria-busy={busy}>
        <label htmlFor="refine-input" className="sr-only">
          What would you like to change?
        </label>
        <input
          id="refine-input"
          type="text"
          maxLength={LIMITS.maxInstruction}
          placeholder="e.g. Reduce the budget by 20%"
          value={instruction}
          onChange={(e) => onInstruction(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Working…" : "Update plan"}
        </button>
      </form>
      <div className="examples" role="group" aria-label="Suggestions">
        {REFINE_SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chip" onClick={() => onInstruction(s)}>
            {s}
          </button>
        ))}
      </div>
      {busy && (
        <p className="loading" aria-hidden="true">
          <span className="spinner" /> Shubā is updating the whole plan… about 25–35 seconds.
        </p>
      )}
    </section>
  );
}
