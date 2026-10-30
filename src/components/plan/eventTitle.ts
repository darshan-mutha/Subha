import { EVENT_TYPE_LABELS } from "@/lib/schemas";
import type { SharedPlanContent } from "@/lib/team";

/** The event's name, or e.g. "our wedding" when it has none. */
export function eventTitle(data: Pick<SharedPlanContent, "input">): string {
  return data.input.eventName || `our ${EVENT_TYPE_LABELS[data.input.eventType].toLowerCase()}`;
}

/** Ease-out curve, so colour starts showing after the first few ticks. */
export function aliveFromProgress(p: number): number {
  return 1 - (1 - p) ** 2;
}

/** e.g. "Wednesday, 27 October 2027". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
