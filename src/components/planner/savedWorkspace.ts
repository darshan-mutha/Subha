import type { LocalWorkspace } from "@/lib/client";
import { loadEvent } from "@/lib/myEvents";
import { PlanSchema, withInputDefaults } from "@/lib/schemas";
import { IdeaStateSchema } from "@/lib/ideas";
import { DEFAULT_SEATING, SeatingSchema } from "@/lib/seating";
import { GuestListSchema } from "@/lib/guestList";
import { InviteSchema } from "@/lib/invite";

/** Reads an event saved in this browser, upgrading plans saved by older versions of Shubā. */
export function savedWorkspace(key: string): LocalWorkspace | null {
  if (!key) return null;
  const saved = loadEvent(key);
  const plan = PlanSchema.safeParse(saved?.plan);
  if (!saved?.input || !plan.success) return null;
  const ideaState = IdeaStateSchema.safeParse(saved.ideaState);
  return {
    ...saved,
    input: withInputDefaults(saved.input),
    plan: plan.data,
    ...(ideaState.success ? { ideaState: ideaState.data } : {}),
    team: saved.team ?? [],
    assignments: saved.assignments ?? {},
    done: saved.done ?? {},
    timings: saved.timings ?? null,
    deals: saved.deals ?? {},
    shifts: saved.shifts ?? {},
    seating: SeatingSchema.catch(DEFAULT_SEATING).parse(saved.seating ?? DEFAULT_SEATING),
    guestList: GuestListSchema.parse(saved.guestList ?? []),
    invite: InviteSchema.nullable()
      .catch(null)
      .parse(saved.invite ?? null),
  };
}

/** Which screen the home page shows. */
export type Mode = "voice" | "form" | "plan" | "events";

/** "/?view=events" opens the list, "/?view=new" starts a new event (used from shared plans). */
export function requestedView(): string {
  return new URLSearchParams(window.location.search).get("view") ?? "";
}
