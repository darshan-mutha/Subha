import { z } from "zod";
import { readJson, readText, removeKey, writeJson, writeText } from "./storage";
import type { Done, SharedPlanContent } from "./team";

/**
 * The browser side of Shubā: the API calls (see ./api) and the small things
 * this browser remembers between visits.
 */
export * from "./api";

/** A plan being worked on in this browser, before or without sharing. */
export interface LocalWorkspace extends SharedPlanContent {
  done: Done;
}

const StoredShape = z.looseObject({
  input: z.looseObject({ eventType: z.string(), date: z.string() }),
  plan: z.looseObject({}),
});

/**
 * A plan saved in this browser. Only its outline is checked here; the plan is
 * validated and upgraded when it is opened (see savedWorkspace).
 */
export const StoredWorkspaceSchema = z.custom<LocalWorkspace>((value) => StoredShape.safeParse(value).success);

/** Where the one-plan version of Shubā kept its plan; moved into My events once. */
const LEGACY_PLAN_KEY = "shuba:last-plan:v2";

/** The plan saved by the one-plan version of Shubā, if any. */
export function loadPlan(): LocalWorkspace | null {
  return readJson(LEGACY_PLAN_KEY, StoredWorkspaceSchema);
}

/** Forgets the plan saved by the one-plan version, once it has been moved. */
export function clearPlan(): void {
  removeKey(LEGACY_PLAN_KEY);
}

/** Per-browser preference: whose tasks to show on a shared plan. */
export function loadViewer(planId: string): string {
  return readText(`shuba:viewer:${planId}`) ?? "";
}

/** Remembers whose tasks to show on a shared plan in this browser. */
export function saveViewer(planId: string, memberId: string): void {
  writeText(`shuba:viewer:${planId}`, memberId);
}

const BloomsSchema = z.array(z.string());

/** Milestones whose celebration has already played on this device, per plan. */
export function loadBlooms(planKey: string): string[] | null {
  return readJson(`shuba:blooms:${planKey}`, BloomsSchema);
}

/** Remembers which milestone celebrations have played on this device. */
export function saveBlooms(planKey: string, ids: string[]): void {
  writeJson(`shuba:blooms:${planKey}`, ids);
}
