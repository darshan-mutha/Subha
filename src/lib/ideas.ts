/**
 * The Ideas section: schemas and choices (schema), browser helpers (state),
 * colour dots (colors), "Add to my plan" (addToPlan), Claude's prompt (prompt)
 * and the server-only AI call (suggest). Client code can import the parts it
 * needs directly, e.g. "@/lib/ideas/state", to keep the AI client out of the bundle.
 */
export {
  DirectionSchema,
  EMPTY_IDEA_STATE,
  FEELINGS,
  FEELING_LABELS,
  HeartSchema,
  IdeaStateSchema,
  LEANINGS,
  LEANING_LABELS,
  type Direction,
  type Feeling,
  type Heart,
  type IdeaState,
  type Leaning,
} from "./ideas/schema";
export { byMoment, carryChosen, ideaId, mergeIdeas, tidyText } from "./ideas/state";
export { themeSwatches } from "./ideas/colors";
export { addIdeaToPlan, type AddResult } from "./ideas/addToPlan";
export {
  IDEAS_SYSTEM_INSTRUCTION,
  IdeasRequestSchema,
  buildIdeasPrompt,
  ideasContext,
  type IdeasRequest,
} from "./ideas/prompt";
export { suggestIdeas, type IdeasResult } from "./ideas/suggest";
