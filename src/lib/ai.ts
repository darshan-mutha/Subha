import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { PlannerError } from "./errors";

export { PlannerError };

export interface GenerateRequest {
  system: string;
  prompt: string;
  jsonSchema: object;
  /** Hard cap on reply length. Plans need more room than a field extraction. */
  maxTokens?: number;
}

/** Anything that can turn a request into raw JSON text. Lets tests swap in a fake. */
export type TextGenerator = (request: GenerateRequest) => Promise<string>;

export const DEFAULT_MODEL = "claude-sonnet-5-5";
const TIMEOUT_MS = 55_000;
const DEFAULT_MAX_TOKENS = 12_000;

/** JSON Schema keywords Claude's structured output does not accept. Zod still enforces them afterwards. */
const UNSUPPORTED_KEYWORDS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "maxItems",
]);

/**
 * Makes a schema acceptable to Claude's structured output: every object gets
 * `additionalProperties: false` and unsupported constraints are dropped.
 */
export function toClaudeSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toClaudeSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    if (key === "minItems" && typeof value === "number" && value > 1) {
      out.minItems = 1;
      continue;
    }
    out[key] = key === "enum" || key === "required" || key === "const" ? value : toClaudeSchema(value);
  }
  if (out.type === "object") out.additionalProperties = false;
  return out;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new PlannerError("The planner is not configured yet. Please try again later.", 503);
  client ??= new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  return client;
}

/** Turns API failures into safe, friendly messages. Never leaks key or provider details. */
function friendlyError(error: unknown): PlannerError {
  if (error instanceof PlannerError) return error;
  const status = (error as { status?: number })?.status;
  // Logged for diagnosis: the kind of failure only, never keys, prompts or user details.
  console.error("AI call failed:", status ?? "no status", error instanceof Error ? error.name : typeof error);
  if (status === 429 || status === 529)
    return new PlannerError("Shubā is very busy right now. Please try again in a minute.", 503);
  if (status === 401 || status === 403)
    return new PlannerError("The planner is not configured yet. Please try again later.", 503);
  return new PlannerError("The AI service is busy right now. Please try again in a minute.", 502);
}

/** Calls Claude with structured JSON output. Runs on the server only. */
export const claudeGenerator: TextGenerator = async ({
  system,
  prompt,
  jsonSchema,
  maxTokens = DEFAULT_MAX_TOKENS,
}) => {
  const ai = getClient();
  try {
    const response = await ai.messages.create({
      model: process.env.CLAUDE_MODEL || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
      thinking: { type: "between_tools" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: toClaudeSchema(jsonSchema) as Record<string, unknown> },
      },
    });
    if (response.stop_reason === "refusal") {
      throw new PlannerError("Shubā can't help with that request. Please describe a celebration or event.", 422);
    }
    return response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  } catch (error) {
    throw friendlyError(error);
  }
};

/** Pulls the JSON object out of a model reply, tolerating code fences. */
export function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) throw new PlannerError("The AI returned an empty reply. Please try again.", 502);
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new PlannerError("The AI returned an incomplete reply. Please try again.", 502);
  }
}

/** Generates and validates a structured reply. Retries once if the reply is malformed. */
export async function generateStructured<S extends z.ZodTypeAny>(
  request: GenerateRequest,
  schema: S,
  generate: TextGenerator = claudeGenerator,
): Promise<z.infer<S>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = schema.safeParse(extractJson(await generate(request)));
      if (parsed.success) return parsed.data;
      console.error(
        "AI reply did not match the schema:",
        parsed.error.issues
          .slice(0, 3)
          .map((i) => i.path.join("."))
          .join(", "),
      );
      lastError = new PlannerError("The AI returned a reply in the wrong format. Please try again.", 502);
    } catch (error) {
      if (error instanceof PlannerError && error.status !== 502) throw error;
      lastError = error;
    }
  }
  if (lastError instanceof PlannerError) throw lastError;
  throw new PlannerError("The AI service is busy right now. Please try again in a minute.", 502);
}
