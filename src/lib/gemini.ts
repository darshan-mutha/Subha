import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";

export class PlannerError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PlannerError";
  }
}

/** Audio attached to a request, base64-encoded. */
export interface AudioPart {
  mimeType: string;
  data: string;
}

export interface GenerateRequest {
  system: string;
  prompt: string;
  jsonSchema: object;
  audio?: AudioPart;
  temperature?: number;
}

/** Anything that can turn a request into raw JSON text. Lets tests swap in a fake. */
export type TextGenerator = (request: GenerateRequest) => Promise<string>;

const DEFAULT_MODEL = "gemini-flash-latest";
const TIMEOUT_MS = 45_000;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new PlannerError("The planner is not configured yet. Please try again later.", 503);
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** Calls Gemini with structured JSON output. Runs on the server only. */
export const geminiGenerator: TextGenerator = async ({ system, prompt, jsonSchema, audio, temperature = 0.8 }) => {
  const ai = getClient();
  const parts = audio ? [{ inlineData: audio }, { text: prompt }] : [{ text: prompt }];
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature,
      maxOutputTokens: 8192,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });
  return response.text ?? "";
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
  generate: TextGenerator = geminiGenerator,
): Promise<z.infer<S>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = schema.safeParse(extractJson(await generate(request)));
      if (parsed.success) return parsed.data;
      lastError = new PlannerError("The AI returned a reply in the wrong format. Please try again.", 502);
    } catch (error) {
      if (error instanceof PlannerError && error.status !== 502) throw error;
      lastError = error;
    }
  }
  if (lastError instanceof PlannerError) throw lastError;
  throw new PlannerError("The AI service is busy right now. Please try again in a minute.", 502);
}
