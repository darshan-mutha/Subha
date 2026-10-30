import type { LocalWorkspace } from "@/lib/client";
import { loadEvent } from "@/lib/myEvents";

/** Reads an event saved in this browser (upgraded as it is read, see StoredWorkspaceSchema). */
export function savedWorkspace(key: string): LocalWorkspace | null {
  return key ? loadEvent(key) : null;
}

/** Which screen the home page shows. */
export type Mode = "voice" | "form" | "plan" | "events";

/** "/?view=events" opens the list, "/?view=new" starts a new event (used from shared plans). */
export function requestedView(): string {
  return new URLSearchParams(window.location.search).get("view") ?? "";
}
