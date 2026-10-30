"use client";

import type { RefObject } from "react";
import type { IdeaState } from "@/lib/ideas/schema";
import type { Idea, Moment } from "@/lib/schemas";
import { FunctionFilter } from "./FunctionFilter";
import type { IdeaHandlers } from "./IdeaCard";
import { MomentGroup } from "./MomentGroup";

interface Props extends IdeaHandlers {
  id: string;
  groups: [Moment, Idea[]][];
  functions: string[];
  filter: string;
  setFilter: (name: string) => void;
  state: IdeaState;
  fresh: string[];
  busy: boolean;
  listRef: RefObject<HTMLHeadingElement | null>;
  skippedCount: number;
  showSkipped: boolean;
  onToggleSkipped: () => void;
}

/** "Ideas for the day": the function filter, ideas grouped by moment, and the show/hide skipped toggle. */
export function IdeasList({
  id,
  groups,
  functions,
  filter,
  setFilter,
  state,
  fresh,
  busy,
  listRef,
  skippedCount,
  showSkipped,
  onToggleSkipped,
  ...handlers
}: Props) {
  return (
    <>
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
          {...handlers}
        />
      ))}

      {skippedCount > 0 && (
        <button type="button" className="btn btn-link btn-small no-print" onClick={onToggleSkipped}>
          {showSkipped ? "Hide skipped ideas" : `Show ${skippedCount} skipped ${skippedCount === 1 ? "idea" : "ideas"}`}
        </button>
      )}
    </>
  );
}
