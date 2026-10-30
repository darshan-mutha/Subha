"use client";

import { formatINR } from "@/lib/budget";
import { EFFORT_LABELS, type Idea } from "@/lib/schemas";

/** The handlers an idea card needs from the Ideas section. */
export interface IdeaHandlers {
  onAdd: (idea: Idea) => void;
  onKeep: (idea: Idea) => void;
  onSkip: (idea: Idea) => void;
  onMore: (idea: Idea) => void;
}

interface Props extends IdeaHandlers {
  idea: Idea;
  isKept: boolean;
  isAdded: boolean;
  isSkipped: boolean;
  isFresh: boolean;
  busy: boolean;
}

/** One idea with its tags, why it fits, and Add / Keep / Skip / More like this. */
export function IdeaCard({ idea, isKept, isAdded, isSkipped, isFresh, busy, onAdd, onKeep, onSkip, onMore }: Props) {
  return (
    <li className={`card-inner idea${isKept ? " is-kept" : ""}${isSkipped ? " is-skipped" : ""}`}>
      <div className="idea-top">
        <h5>{idea.title}</h5>
        {isFresh && <span className="badge badge-new">New</span>}
      </div>
      <ul className="idea-tags small" aria-label="About this idea">
        {idea.forFunction && <li>{idea.forFunction}</li>}
        <li>{EFFORT_LABELS[idea.effort]}</li>
        {idea.cost > 0 && <li>About {formatINR(idea.cost)} (estimate)</li>}
      </ul>
      {idea.detail && <p>{idea.detail}</p>}
      {idea.why && (
        <p className="why small">
          <span className="why-label">Why it fits:</span> {idea.why}
        </p>
      )}
      <div className="idea-actions no-print">
        {isAdded ? (
          <span className="small done-text">
            <span aria-hidden="true">✓ </span>In your plan
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-small btn-primary"
            disabled={busy || isSkipped}
            aria-label={`Add to my plan: ${idea.title}`}
            onClick={() => onAdd(idea)}
          >
            Add to my plan
          </button>
        )}
        <button
          type="button"
          className="btn btn-small"
          aria-pressed={isKept}
          aria-label={`Keep: ${idea.title}`}
          disabled={isSkipped}
          onClick={() => onKeep(idea)}
        >
          <span aria-hidden="true">{isKept ? "♥ " : "♡ "}</span>
          {isKept ? "Kept" : "Keep"}
        </button>
        <button
          type="button"
          className="btn btn-small btn-link"
          aria-label={`${isSkipped ? "Bring back" : "Skip"}: ${idea.title}`}
          disabled={isAdded}
          onClick={() => onSkip(idea)}
        >
          {isSkipped ? "Bring back" : "Skip"}
        </button>
        <button
          type="button"
          className="btn btn-small btn-link"
          aria-label={`More like this: ${idea.title}`}
          disabled={busy || isSkipped}
          onClick={() => onMore(idea)}
        >
          More like this
        </button>
      </div>
    </li>
  );
}
