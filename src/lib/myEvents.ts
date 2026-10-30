import { z } from "zod";
import { clearPlan, loadPlan, StoredWorkspaceSchema, type LocalWorkspace } from "./client";
import { EVENT_TYPE_LABELS, EVENT_TYPES, type EventInput } from "./schemas";
import { readJson, removeKey, writeJson } from "./storage";
import { SHARE_ID } from "./team";

/**
 * "My events": several celebrations on one device, without a login.
 *
 * Each event not yet shared is kept whole in this browser. Once shared, the
 * plan lives on the server and this list keeps only its link, so it can be
 * opened again here (and on any other phone through the same link). Plans
 * opened from someone else's link are added too, so helpers find them again.
 */

export const MAX_EVENTS = 30;
const INDEX_KEY = "shuba:events:v1";
const CURRENT_KEY = "shuba:events:current";
const eventKey = (key: string) => `shuba:event:${key}`;

const KEY = /^e[a-z0-9]{4,16}$/;

export const EventEntrySchema = z.object({
  key: z.string().regex(KEY),
  title: z.string().max(120),
  eventType: z.enum(EVENT_TYPES).catch("other"),
  date: z.string().max(10),
  city: z.string().max(60).catch(""),
  updatedAt: z.number().catch(0),
  /** Set once the plan has a team link; the plan then lives on the server. */
  sharedId: z.string().regex(SHARE_ID).optional().catch(undefined),
});
export type EventEntry = z.infer<typeof EventEntrySchema>;

const IndexSchema = z
  .array(z.unknown())
  .catch([])
  .transform((list) =>
    list
      .map((item) => EventEntrySchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data),
  );

export function newEventKey(): string {
  return `e${Math.random().toString(36).slice(2, 12).padEnd(6, "0")}`;
}

export function titleOf(input: Pick<EventInput, "eventName" | "eventType">): string {
  return input.eventName || EVENT_TYPE_LABELS[input.eventType];
}

/** Upcoming events first (soonest at the top), then past ones (most recent first). */
export function sortEvents(list: EventEntry[], today: string): EventEntry[] {
  const upcoming = list.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = list.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return [...upcoming, ...past];
}

function readIndex(): EventEntry[] {
  return readJson(INDEX_KEY, IndexSchema) ?? [];
}

function writeIndex(list: EventEntry[]) {
  // Keep the most recently used events if the list grows too long.
  // On a tie, the entry added last (the one just saved) wins.
  const kept = list
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => b.entry.updatedAt - a.entry.updatedAt || b.i - a.i)
    .slice(0, MAX_EVENTS)
    .map(({ entry }) => entry);
  for (const dropped of list.filter((e) => !kept.includes(e))) removeKey(eventKey(dropped.key));
  writeJson(INDEX_KEY, kept);
}

/**
 * Moves a plan saved by the one-plan version of Shubā into the list, once.
 * Safe to call on every load.
 */
export function migrateLastPlan(): void {
  const old = loadPlan();
  if (!old?.input) return;
  const key = newEventKey();
  if (saveEvent(key, old)) {
    setCurrentEvent(key);
    clearPlan();
  }
}

export function listEvents(): EventEntry[] {
  migrateLastPlan();
  return readIndex();
}

export function loadEvent(key: string): LocalWorkspace | null {
  return KEY.test(key) ? readJson(eventKey(key), StoredWorkspaceSchema) : null;
}

function entryFor(key: string, input: EventInput, extra: Partial<EventEntry> = {}): EventEntry {
  return {
    key,
    title: titleOf(input),
    eventType: input.eventType,
    date: input.date,
    city: input.city,
    updatedAt: Date.now(),
    ...extra,
  };
}

/** Saves an event kept on this device and updates its line in the list. */
export function saveEvent(key: string, data: LocalWorkspace): boolean {
  if (!KEY.test(key) || !data?.input) return false;
  if (!writeJson(eventKey(key), data)) return false;
  const list = readIndex().filter((e) => e.key !== key);
  writeIndex([...list, entryFor(key, data.input)]);
  return true;
}

/** The plan now has a team link: keep the link in the list and drop the local copy. */
export function markShared(key: string, sharedId: string, input: EventInput): void {
  const list = readIndex().filter((e) => e.key !== key && e.sharedId !== sharedId);
  writeIndex([...list, entryFor(key, input, { sharedId })]);
  removeKey(eventKey(key));
}

/** A shared plan was opened here (by the host or a helper): add or refresh it in the list. */
export function rememberShared(sharedId: string, input: EventInput): void {
  if (!SHARE_ID.test(sharedId)) return;
  const list = readIndex();
  const existing = list.find((e) => e.sharedId === sharedId);
  const next = entryFor(existing?.key ?? newEventKey(), input, { sharedId });
  if (
    existing &&
    existing.title === next.title &&
    existing.date === next.date &&
    existing.city === next.city &&
    existing.eventType === next.eventType
  ) {
    return; // nothing new; avoids rewriting storage on every refresh
  }
  writeIndex([...list.filter((e) => e !== existing), next]);
}

/** Removes an event from this device. A shared plan stays on its link for the team. */
export function removeEvent(key: string): void {
  writeIndex(readIndex().filter((e) => e.key !== key));
  removeKey(eventKey(key));
  if (currentEvent() === key) setCurrentEvent("");
}

/** The event that was open last on this device. */
export function currentEvent(): string {
  return readJson(CURRENT_KEY, z.string().regex(KEY)) ?? "";
}

export function setCurrentEvent(key: string): void {
  if (key) writeJson(CURRENT_KEY, key);
  else removeKey(CURRENT_KEY);
}
