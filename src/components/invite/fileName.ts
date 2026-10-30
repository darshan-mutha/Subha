import type { EventInput } from "@/lib/schemas";

/** Download name for the card, from the event's name or type. */
export function inviteFileName(input: EventInput): string {
  const base = (input.eventName || input.eventType)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "shuba"}-invite.png`;
}
