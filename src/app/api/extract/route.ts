import { MAX_AUDIO_BASE64 } from "@/lib/audio";
import { ExtractRequestSchema, extractEventDetails } from "@/lib/extract";
import { handleJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleJson(request, ExtractRequestSchema, (body) => extractEventDetails(body), {
    maxBytes: MAX_AUDIO_BASE64 + 2_000,
  });
}
