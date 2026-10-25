import { ExtractRequestSchema, extractEventDetails } from "@/lib/extract";
import { handleJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleJson(request, ExtractRequestSchema, (body) => extractEventDetails(body), { maxBytes: 4_000 });
}
