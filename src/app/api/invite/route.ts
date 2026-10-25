import { draftInvite, InviteRequestSchema } from "@/lib/invite";
import { handleJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Writes the words for an invitation card. Date, time and venue are added by code. */
export async function POST(request: Request) {
  return handleJson(request, InviteRequestSchema, (body) => draftInvite(body), { maxBytes: 8_000 });
}
