import { hash } from "../hash";
import { MOMENTS, type Idea, type Moment } from "../schemas";
import type { IdeaState } from "./schema";

/* Helpers for the Ideas section in the browser: ids, grouping and merging. */

/**
 * Phone keyboards type curly quotes and long dashes; Shubā's text rules accept
 * plain ones. Anything else unusual (emoji, symbols) becomes a space.
 */
export function tidyText(text: string, max: number): string {
  return text
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}\s.,'&()\-/!?:;₹%+#@"]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** A stable id for an idea, from its title. */
export function ideaId(idea: Pick<Idea, "title">): string {
  return `i_${hash(idea.title.trim().toLowerCase())}`;
}

/** Ideas grouped by the guest's day, without skipped ones, in a fixed order. */
export function byMoment(items: Idea[], skipped: readonly string[], forFunction = ""): [Moment, Idea[]][] {
  const hidden = new Set(skipped);
  const shown = items.filter(
    (i) => !hidden.has(ideaId(i)) && (!forFunction || i.forFunction.toLowerCase() === forFunction.toLowerCase()),
  );
  return MOMENTS.map((m) => [m, shown.filter((i) => i.moment === m)] as [Moment, Idea[]]).filter(
    ([, list]) => list.length > 0,
  );
}

/** Adds new ideas after the existing ones, skipping any with the same title. */
export function mergeIdeas(existing: Idea[], incoming: Idea[], max = 40): Idea[] {
  const seen = new Set(existing.map(ideaId));
  const fresh = incoming.filter((i) => {
    const id = ideaId(i);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  // Keep the newest when the list is full, but never drop the host's kept or added ideas (handled by the caller).
  return [...existing, ...fresh].slice(-max);
}

/**
 * After the plan is rewritten (a change request or a new theme), ideas the host
 * kept or added are carried over so their choices are never lost.
 */
export function carryChosen(before: Idea[], after: Idea[], state: Pick<IdeaState, "kept" | "added">): Idea[] {
  const chosen = new Set([...state.kept, ...state.added]);
  const keep = before.filter((i) => chosen.has(ideaId(i)));
  const afterIds = new Set(after.map(ideaId));
  return [...keep.filter((i) => !afterIds.has(ideaId(i))), ...after].slice(0, 40);
}
