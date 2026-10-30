"use client";

import { useId, useState } from "react";
import { EMPTY_IDEA_STATE, byMoment, ideaId, themeSwatches, tidyText, type Feeling, type IdeaState } from "@/lib/ideas";
import type { EventInput, Idea, Plan } from "@/lib/schemas";
import { FunctionFilter } from "./ideas/FunctionFilter";
import { HeartCard } from "./ideas/HeartCard";
import { MomentGroup } from "./ideas/MomentGroup";
import { OwnIdeaForm } from "./ideas/OwnIdeaForm";
import { SignatureMoment } from "./ideas/SignatureMoment";
import { ThemeDirections } from "./ideas/ThemeDirections";
import { WAIT, useIdeasActions } from "./ideas/useIdeasActions";

interface Props {
  input: EventInput;
  plan: Plan;
  state: IdeaState | undefined;
  /** Saves a new plan and/or idea choices. */
  onSave: (next: { plan?: Plan; ideaState: IdeaState }) => Promise<void>;
  /** Turns an idea into a task, budget and vendor message (with What changed and Undo). */
  onAdd: (idea: Idea, ideaState: IdeaState) => Promise<void>;
}

/**
 * Ideas: start from the heart of the event (who it is for, how guests should
 * feel), pick one of three theme directions, then keep, skip or add ideas
 * that follow the guest's day. The host's own idea is always welcome.
 */
export function IdeasPanel({ input, plan, state = EMPTY_IDEA_STATE, onSave, onAdd }: Props) {
  const id = useId();
  const [forWhom, setForWhom] = useState(state.heart.forWhom);
  const [feelings, setFeelings] = useState<Feeling[]>(state.heart.feelings);
  const [own, setOwn] = useState(state.heart.own);
  const [filter, setFilter] = useState("");
  const [showSkipped, setShowSkipped] = useState(false);

  const heart = { forWhom: tidyText(forWhom, 80), feelings, own: tidyText(own, 300) };
  const { job, busy, error, announce, fresh, directionsRef, listRef, ...act } = useIdeasActions({
    input,
    plan,
    state,
    heart,
    onSave,
    onAdd,
    clearFilter: () => setFilter(""),
  });
  const functions = plan.functions.map((f) => f.name);
  const groups = byMoment(plan.ideas.items, showSkipped ? [] : state.skipped, filter);
  const skippedCount = plan.ideas.items.filter((i) => state.skipped.includes(ideaId(i))).length;

  return (
    <div className="ideas">
      <h2 className="section-title">Ideas</h2>
      <p className="muted">
        Start from the heart of your celebration. Shubā shapes a theme around it, then ideas for every part of the day.
        Keep what you love, skip the rest, and add any idea to your plan.
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <HeartCard
        id={id}
        eventName={input.eventName}
        forWhom={forWhom}
        setForWhom={setForWhom}
        feelings={feelings}
        setFeelings={setFeelings}
        theme={plan.theme}
        colors={themeSwatches(plan.theme)}
        job={job}
        hasDirections={state.directions.length > 0}
        onShowThemes={() => void act.showThemes()}
      />

      {job !== null && (
        <p className="loading" aria-hidden="true">
          <span className="spinner" /> {WAIT[job]}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {state.directions.length > 0 && (
        <ThemeDirections
          id={id}
          directions={state.directions}
          currentName={plan.theme.name}
          busy={busy}
          headingRef={directionsRef}
          onChoose={(d) => void act.choose(d)}
        />
      )}

      {plan.ideas.signature && (
        <SignatureMoment
          id={id}
          signature={plan.ideas.signature}
          added={new Set(state.added)}
          busy={busy}
          onAdd={act.addSignature}
        />
      )}

      <OwnIdeaForm id={id} own={own} setOwn={setOwn} functions={functions} job={job} onSubmit={act.submitOwn} />

      <h3 ref={listRef} tabIndex={-1} className="section-title ideas-heading">
        Ideas for the day
      </h3>
      <FunctionFilter functions={functions} filter={filter} setFilter={setFilter} />

      {groups.length === 0 && (
        <p className="muted">
          {filter ? `No ideas for ${filter} yet. Ask for some in the box above.` : "No ideas yet. Ask for some above."}
        </p>
      )}

      {groups.map(([moment, list]) => (
        <MomentGroup
          key={moment}
          id={id}
          moment={moment}
          ideas={list}
          state={state}
          fresh={fresh}
          busy={busy}
          onAdd={act.addIdea}
          onKeep={act.keep}
          onSkip={act.skip}
          onMore={act.moreLike}
        />
      ))}

      {skippedCount > 0 && (
        <button type="button" className="btn btn-link btn-small no-print" onClick={() => setShowSkipped((s) => !s)}>
          {showSkipped ? "Hide skipped ideas" : `Show ${skippedCount} skipped ${skippedCount === 1 ? "idea" : "ideas"}`}
        </button>
      )}
      <p className="muted small">Costs are rough estimates for {input.city}, not quotes.</p>
    </div>
  );
}
