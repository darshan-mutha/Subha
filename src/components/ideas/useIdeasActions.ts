"use client";

import { useRef, useState } from "react";
import { ApiError, requestIdeas } from "@/lib/client";
import {
  carryChosen,
  ideaId,
  ideasContext,
  mergeIdeas,
  tidyText,
  type Direction,
  type Heart,
  type IdeaState,
  type IdeasRequest,
  type Leaning,
} from "@/lib/ideas";
import type { EventInput, Idea, Plan } from "@/lib/schemas";

/** Which Shubā request is running, if any. */
export type Job = "themes" | "ideas" | "more" | null;

/** What the host sees while each request runs. */
export const WAIT: Record<Exclude<Job, null>, string> = {
  themes: "Shubā is sketching three themes for you… about 15–25 seconds.",
  ideas: "Shubā is filling your day with ideas for this theme… about 20–30 seconds.",
  more: "Shubā is building on your idea… about 10–20 seconds.",
};

interface Options {
  input: EventInput;
  plan: Plan;
  state: IdeaState;
  heart: Heart;
  onSave: (next: { plan?: Plan; ideaState: IdeaState }) => Promise<void>;
  onAdd: (idea: Idea, ideaState: IdeaState) => Promise<void>;
  /** Called when new ideas arrive, so they are not hidden by a function filter. */
  clearFilter: () => void;
}

/** Requests to Shubā and the keep / skip / add choices for the Ideas section, with status and focus handling. */
export function useIdeasActions({ input, plan, state, heart, onSave, onAdd, clearFilter }: Options) {
  const [job, setJob] = useState<Job>(null);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [fresh, setFresh] = useState<string[]>([]);
  const directionsRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLHeadingElement>(null);

  async function ask(mode: Exclude<Job, null>, extra: Partial<IdeasRequest> = {}) {
    setJob(mode);
    setError("");
    setAnnounce(WAIT[mode]);
    try {
      const result = await requestIdeas({
        input,
        context: ideasContext(plan),
        heart,
        mode,
        direction: null,
        leanings: [],
        seed: "",
        forFunction: "",
        ...extra,
      });
      return result;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setAnnounce("");
      return null;
    } finally {
      setJob(null);
    }
  }

  async function showThemes() {
    const result = await ask("themes");
    if (!result || result.mode !== "themes") return;
    await onSave({ ideaState: { ...state, heart, directions: result.directions } });
    setAnnounce("Three theme ideas are ready. Choose the one that feels like you.");
    requestAnimationFrame(() => directionsRef.current?.focus());
  }

  async function choose(direction: Direction) {
    const result = await ask("ideas", { direction });
    if (!result || result.mode === "themes") return;
    const items = carryChosen(plan.ideas.items, result.items, state);
    const next: Plan = {
      ...plan,
      theme: {
        name: direction.name,
        description: direction.mood,
        colors: direction.colors.map((c) => c.name),
        swatches: direction.colors.map((c) => c.hex),
      },
      ideas: { signature: result.signature ?? direction.signature, items },
    };
    await onSave({ plan: next, ideaState: { ...state, heart, skipped: [] } });
    setFresh(result.items.map(ideaId));
    setAnnounce(`Your theme is now ${direction.name}, with ${result.items.length} ideas to match.`);
    requestAnimationFrame(() => listRef.current?.focus());
  }

  async function more(extra: Partial<IdeasRequest>, message: string) {
    const result = await ask("more", extra);
    if (!result || result.mode === "themes") return;
    const items = mergeIdeas(plan.ideas.items, result.items);
    await onSave({ plan: { ...plan, ideas: { ...plan.ideas, items } }, ideaState: { ...state, heart } });
    setFresh(result.items.map(ideaId));
    clearFilter();
    setAnnounce(`${result.items.length} new ideas ${message}. They are marked New below.`);
    requestAnimationFrame(() => listRef.current?.focus());
  }

  function submitOwn(leanings: Leaning[], ownFunction: string) {
    if (heart.own.length < 3 && leanings.length === 0) {
      setError("Type your idea, or pick a starting point such as Budget-friendly.");
      return;
    }
    void more({ leanings, forFunction: tidyText(ownFunction, 40) }, "built on your idea");
  }

  function moreLike(idea: Idea) {
    void more(
      { seed: tidyText(`${idea.title}. ${idea.detail}`, 240), forFunction: tidyText(idea.forFunction, 40) },
      `like "${idea.title}"`,
    );
  }

  const save = (ideaState: IdeaState) => void onSave({ ideaState }).catch(() => undefined);

  function keep(idea: Idea) {
    const iid = ideaId(idea);
    const on = !state.kept.includes(iid);
    save({ ...state, kept: on ? [...state.kept, iid] : state.kept.filter((x) => x !== iid) });
    setAnnounce(on ? `Kept: ${idea.title}` : `No longer kept: ${idea.title}`);
  }

  function skip(idea: Idea) {
    const iid = ideaId(idea);
    const on = !state.skipped.includes(iid);
    save({
      ...state,
      skipped: on ? [...state.skipped, iid] : state.skipped.filter((x) => x !== iid),
      kept: state.kept.filter((x) => x !== iid),
    });
    setAnnounce(on ? `Skipped: ${idea.title}` : `Brought back: ${idea.title}`);
  }

  function addIdea(idea: Idea) {
    const iid = ideaId(idea);
    const isKept = state.kept.includes(iid);
    void onAdd(idea, {
      ...state,
      added: [...state.added, iid],
      kept: isKept ? state.kept : [...state.kept, iid],
    });
  }

  function addSignature(sig: Idea) {
    void onAdd(sig, { ...state, added: [...state.added, ideaId(sig)] });
  }

  return {
    job,
    busy: job !== null,
    error,
    announce,
    fresh,
    directionsRef,
    listRef,
    showThemes,
    choose,
    submitOwn,
    moreLike,
    keep,
    skip,
    addIdea,
    addSignature,
  };
}
