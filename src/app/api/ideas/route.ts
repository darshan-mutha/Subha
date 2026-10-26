import { handleJson } from "@/lib/http";
import { IdeasRequestSchema, suggestIdeas } from "@/lib/ideas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Theme directions, or ideas for a chosen theme or from the host's own idea. */
export async function POST(request: Request) {
  return handleJson(request, IdeasRequestSchema, (body) => suggestIdeas(body), { maxBytes: 16_000 });
}
