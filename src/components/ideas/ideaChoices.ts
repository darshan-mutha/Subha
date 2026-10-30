import type { Direction, IdeaState } from "@/lib/ideas/schema";
import { ideaId } from "@/lib/ideas/state";
import type { Idea, Plan } from "@/lib/schemas";

/** The plan's theme taken from a chosen direction (name, mood, colour names and swatches). */
export function themeFromDirection(direction: Direction): Plan["theme"] {
  return {
    name: direction.name,
    description: direction.mood,
    colors: direction.colors.map((c) => c.name),
    swatches: direction.colors.map((c) => c.hex),
  };
}

interface ChoiceOptions {
  state: IdeaState;
  onSave: (next: { ideaState: IdeaState }) => Promise<void>;
  onAdd: (idea: Idea, ideaState: IdeaState) => Promise<void>;
  setAnnounce: (message: string) => void;
}

/** Keep, skip and add-to-plan handlers for single ideas; each saves the new choices and says what happened. */
export function ideaChoices({ state, onSave, onAdd, setAnnounce }: ChoiceOptions) {
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

  return { keep, skip, addIdea, addSignature };
}
