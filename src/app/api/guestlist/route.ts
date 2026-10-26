import { suggestGuestGroups, GuestGroupsRequestSchema } from "@/lib/guestGroups";
import { handleJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Groups of people to think of for the guest list. No guest names are sent. */
export async function POST(request: Request) {
  return handleJson(request, GuestGroupsRequestSchema, (body) => suggestGuestGroups(body), { maxBytes: 8_000 });
}
