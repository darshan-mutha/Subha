import { toCsv } from "../csv";
import { GUEST_GROUP_LABELS, type GuestGroup, type Reply } from "../rsvp";
import type { GuestEntry, GuestList } from "./entry";
import { entryStatus, matchReplies, needsReminder, STATUS_LABELS, type EntryStatus } from "./match";

/**
 * The list as the host sees it: rows with their status, filters, counts,
 * and the CSV download.
 */

export const LIST_FILTERS = ["all", "not-invited", "invited", "coming", "maybe", "no", "remind"] as const;
export type ListFilter = (typeof LIST_FILTERS)[number] | `side:${GuestGroup}`;

export function filterLabel(filter: ListFilter): string {
  if (filter.startsWith("side:")) return GUEST_GROUP_LABELS[filter.slice(5) as GuestGroup] || "No side";
  const labels: Record<string, string> = {
    all: "All",
    "not-invited": "Not invited",
    invited: "No reply",
    coming: "Coming",
    maybe: "Maybe",
    no: "Can't come",
    remind: "Needs a reminder",
  };
  return labels[filter];
}

export interface ListRow {
  entry: GuestEntry;
  reply?: Reply;
  status: EntryStatus;
  remind: boolean;
}

export function listRows(entries: GuestList, replies: Reply[], today: string): ListRow[] {
  const matched = matchReplies(entries, replies);
  return entries.map((entry) => {
    const reply = matched.get(entry.id);
    return { entry, reply, status: entryStatus(entry, reply), remind: needsReminder(entry, reply, today) };
  });
}

export function rowMatches(row: ListRow, filter: ListFilter): boolean {
  if (filter === "all") return true;
  if (filter === "remind") return row.remind;
  if (filter.startsWith("side:")) return row.entry.side === filter.slice(5);
  return row.status === filter;
}

export interface ListSummary {
  families: number;
  people: number;
  invited: number;
  noReply: number;
  notInvited: number;
  comingPeople: number;
  maybePeople: number;
  noFamilies: number;
  remind: number;
  sides: GuestGroup[];
}

export function listSummary(rows: ListRow[]): ListSummary {
  const count = (s: EntryStatus) => rows.filter((r) => r.status === s);
  const replyPeople = (r: ListRow) => (r.reply ? r.reply.adults + r.reply.kids : r.entry.people);
  return {
    families: rows.length,
    people: rows.reduce((s, r) => s + r.entry.people, 0),
    invited: rows.filter((r) => r.status !== "not-invited").length,
    noReply: count("invited").length,
    notInvited: count("not-invited").length,
    comingPeople: count("coming").reduce((s, r) => s + replyPeople(r), 0),
    maybePeople: count("maybe").reduce((s, r) => s + replyPeople(r), 0),
    noFamilies: count("no").length,
    remind: rows.filter((r) => r.remind).length,
    sides: [...new Set(rows.map((r) => r.entry.side))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : 0)),
  };
}

/**
 * Suggests matching the plan to the list, only when that is clearly right:
 * the list is bigger than planned, or the list looks finished (everyone on it
 * invited) and is clearly smaller. A list still being built never shrinks the plan.
 */
export function listSuggestsGuests(
  people: number,
  planned: number,
  families: number,
  allInvited: boolean,
): number | null {
  if (families < 5 || people < 1) return null;
  const gap = Math.abs(people - planned);
  if (gap < Math.max(5, planned * 0.05)) return null;
  return people > planned || allInvited ? people : null;
}

/* ------------------------------------------------------------------ */
/* Messages and files.                                                 */

export function guestListCsv(rows: ListRow[]): string {
  const head = ["Name", "People", "Phone", "Side", "Functions", "Status", "Invited on", "Coming (from reply)"];
  const lines = rows.map((r) => [
    r.entry.name,
    r.entry.people,
    r.entry.phone,
    GUEST_GROUP_LABELS[r.entry.side],
    r.entry.functions.join("; ") || "All",
    STATUS_LABELS[r.status],
    r.entry.invitedAt,
    r.reply && r.reply.coming !== "no" ? r.reply.adults + r.reply.kids : "",
  ]);
  return toCsv([head, ...lines]);
}

/* ------------------------------------------------------------------ */
/* Functions: who on the list is invited, and who is coming.           */
/* ------------------------------------------------------------------ */
