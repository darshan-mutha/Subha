import { z } from "zod";

/** Text from the AI: clipped to fit rather than rejected, since a retry costs the host 20-30 seconds. */

/**
 * Cuts over-long text at a word boundary. A label that runs a few characters
 * long is trimmed rather than throwing away the whole AI reply (a retry costs
 * the host another 20-30 seconds).
 */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–(]+$/u, "")}…`;
}

export const str = (max = 400) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((v) => clip(v, max));
/** A list that keeps its first `maxItems` items instead of rejecting a longer one. */
export const upTo = <T extends z.ZodTypeAny>(item: T, maxItems: number) =>
  z.array(item).transform((list) => list.slice(0, maxItems));
export const strList = (maxItems: number, max = 200) => upTo(str(max), maxItems).default([]);
