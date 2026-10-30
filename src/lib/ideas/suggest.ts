import { z } from "zod";
import { claudeGenerator, generateStructured, PlannerError, type TextGenerator } from "../ai";
import { IDEA_JSON, SIGNATURE_JSON } from "../promptSchemas";
import { IdeaSchema, SignatureSchema, type Idea } from "../schemas";
import { IDEAS_SYSTEM_INSTRUCTION, buildIdeasPrompt, type IdeasRequest } from "./prompt";
import { DirectionSchema, type Direction } from "./schema";
import { validItems } from "../validation";

/* Server only: asks Claude for theme directions and ideas. */

const DIRECTIONS_JSON = {
  type: "object",
  properties: {
    directions: {
      type: "array",
      description: "Exactly 3 directions",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          mood: { type: "string", description: "One line" },
          colors: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, hex: { type: "string", description: "#RRGGBB" } },
              required: ["name", "hex"],
            },
          },
          decor: { type: "string" },
          food: { type: "string" },
          fun: { type: "string" },
          signature: SIGNATURE_JSON,
          fit: { type: "string", enum: ["fits", "stretch"] },
        },
        required: ["name", "mood", "colors", "decor", "food", "fun", "signature", "fit"],
      },
    },
  },
  required: ["directions"],
} as const;

const IDEAS_JSON = {
  type: "object",
  properties: {
    signature: SIGNATURE_JSON,
    items: { type: "array", items: IDEA_JSON },
  },
  required: ["signature", "items"],
} as const;

const DirectionsReply = z.object({
  directions: z
    .array(z.unknown())
    .transform((list) => validItems(list, DirectionSchema).slice(0, 3))
    .refine((list) => list.length > 0, "No directions"),
});

const IdeasReply = z.object({
  signature: SignatureSchema.nullable().catch(null).default(null),
  items: z
    .array(z.unknown())
    .transform((list) => validItems(list, IdeaSchema))
    .refine((list) => list.length > 0, "No ideas"),
});

export type IdeasResult =
  | { mode: "themes"; directions: Direction[] }
  | { mode: "ideas" | "more"; signature: z.infer<typeof SignatureSchema> | null; items: Idea[] };

/** Asks Claude for theme directions or ideas. */
export async function suggestIdeas(req: IdeasRequest, generate: TextGenerator = claudeGenerator): Promise<IdeasResult> {
  const base = { system: IDEAS_SYSTEM_INSTRUCTION, prompt: buildIdeasPrompt(req), maxTokens: 6_000 };
  try {
    if (req.mode === "themes") {
      const reply = await generateStructured({ ...base, jsonSchema: DIRECTIONS_JSON }, DirectionsReply, generate);
      return { mode: "themes", directions: reply.directions };
    }
    const reply = await generateStructured({ ...base, jsonSchema: IDEAS_JSON }, IdeasReply, generate);
    const items = req.forFunction ? reply.items.map((i) => ({ ...i, forFunction: req.forFunction })) : reply.items;
    // A signature moment only comes with a full set for a chosen theme.
    const signature = req.mode === "ideas" ? reply.signature : null;
    return { mode: req.mode, signature, items: items.slice(0, req.mode === "ideas" ? 14 : 6) };
  } catch (error) {
    if (error instanceof PlannerError) throw error;
    throw new PlannerError("Shubā couldn't come up with ideas just now. Please try again.", 502);
  }
}
