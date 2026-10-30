import { z } from "zod";

/**
 * Validation pieces shared by the schemas: which characters text may hold,
 * and lists that keep what is valid instead of failing as a whole.
 */

/** Letters in any script, digits, spaces and everyday punctuation. Blocks markup and code-like input. */
export const SAFE_TEXT = /^[\p{L}\p{M}\p{N}\s.,'&()\-/!?:;₹%+#@"]*$/u;
/** Every character SAFE_TEXT does not allow, for stripping them out of text. */
export const UNSAFE_CHARS = /[^\p{L}\p{M}\p{N}\s.,'&()\-/!?:;₹%+#@"]/gu;
/** A person's or business's name: letters, digits and name punctuation only. */
export const NAME_TEXT = /^[\p{L}\p{M}\p{N}\s.,'&()\-/]+$/u;

/** The items `schema` accepts; the rest are dropped, so one bad item never loses the others. */
export function validItems<T>(list: readonly unknown[], schema: z.ZodType<T>): T[] {
  return list.flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

/** A list that keeps its valid items (the first `max` of them). Anything that is not a list becomes empty. */
export function validList<T extends z.ZodTypeAny>(item: T, max = Infinity) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((list) => validItems(list, item).slice(0, max) as z.infer<T>[]);
}

/** The values in `list` that are in `known`, without duplicates and in the order given. */
export function knownValues<T extends string>(list: readonly string[], known: readonly T[]): T[] {
  return [...new Set(list)].filter((v): v is T => (known as readonly string[]).includes(v));
}

/** Known values only, without duplicates, up to `max`; anything else becomes an empty list. */
export const knownOnly = <T extends string>(values: readonly T[], max: number) =>
  z
    .array(z.string())
    .catch([])
    .default([])
    .transform((list) => knownValues(list, values).slice(0, max));
