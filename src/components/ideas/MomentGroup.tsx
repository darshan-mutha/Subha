"use client";

import type { IdeaState } from "@/lib/ideas/schema";
import { ideaId } from "@/lib/ideas/state";
import { MOMENT_LABELS, type Idea, type Moment } from "@/lib/schemas";
import { IdeaCard, type IdeaHandlers } from "./IdeaCard";

interface Props extends IdeaHandlers {
  id: string;
  moment: Moment;
  ideas: Idea[];
  state: IdeaState;
  fresh: string[];
  busy: boolean;
}

/** The ideas for one moment of the guest's day. */
export function MomentGroup({ id, moment, ideas, state, fresh, busy, ...handlers }: Props) {
  return (
    <section className="moment" aria-labelledby={`${id}-m-${moment}`}>
      <h4 id={`${id}-m-${moment}`} className="moment-title">
        {MOMENT_LABELS[moment]}
      </h4>
      <ul className="idea-cards">
        {ideas.map((idea) => {
          const iid = ideaId(idea);
          return (
            <IdeaCard
              key={iid}
              idea={idea}
              isKept={state.kept.includes(iid)}
              isAdded={state.added.includes(iid)}
              isSkipped={state.skipped.includes(iid)}
              isFresh={fresh.includes(iid)}
              busy={busy}
              {...handlers}
            />
          );
        })}
      </ul>
    </section>
  );
}
