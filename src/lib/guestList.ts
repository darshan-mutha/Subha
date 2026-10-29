import { z } from "zod";
import { GUEST_GROUP_LABELS, GUEST_GROUPS, type GuestGroup, type Reply } from "./rsvp";

/**
 * The host's own guest list: families or groups with a head count, phone,
 * side and the functions they are invited to. Kept with the plan (on the
 * device, or online once shared). Names and numbers never go to the AI:
 * pasted lists are read by code, and "Help me build it" only sends the kind
 * of event and the numbers.
 *
 * Replies that come in through the guest link are matched to the list by
 * phone number, or else by name, so the host sees who has answered.
 */

export const MAX_GUEST_ENTRIES = 400;
export const MAX_PEOPLE_PER_ENTRY = 50;
/** Days after an invitation (or a reminder) before Shubā suggests a reminder. */
export const REMIND_AFTER_DAYS = 7;

const ENTRY_ID = /^g[a-z0-9]{4,16}$/;
const NAME_TEXT = /^[\p{L}\p{M}\p{N}\s.,'&()\-/+]+$/u;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const GuestEntrySchema = z.object({
  id: z.string().regex(ENTRY_ID),
  name: z
    .string()
    .trim()
    .min(1, "Please enter a name")
    .max(80, "Name is too long")
    .regex(NAME_TEXT, "Name can only contain letters and numbers"),
  people: z.coerce
    .number({ message: "Please enter how many people" })
    .int("Please enter a whole number")
    .min(1, "At least 1 person")
    .max(MAX_PEOPLE_PER_ENTRY, `Up to ${MAX_PEOPLE_PER_ENTRY} people per entry`),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number is too long")
    .regex(/^[0-9+\s-]*$/, "Phone can only contain numbers")
    .default(""),
  side: z.enum(GUEST_GROUPS).catch("").default(""),
  /** Function names this family is invited to. Empty means every function. */
  functions: z.array(z.string().trim().min(1).max(60)).max(12).catch([]).default([]),
  /** Day the invitation was sent ("" = not yet). */
  invitedAt: z
    .union([z.string().regex(ISO_DAY), z.literal("")])
    .catch("")
    .default(""),
  remindedAt: z
    .union([z.string().regex(ISO_DAY), z.literal("")])
    .catch("")
    .default(""),
});
export type GuestEntry = z.infer<typeof GuestEntrySchema>;

/** Keeps every valid entry; a damaged one is dropped rather than losing the whole list. */
export const GuestListSchema = z
  .array(z.unknown())
  .catch([])
  .transform((list) =>
    list
      .map((item) => GuestEntrySchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data)
      .slice(0, MAX_GUEST_ENTRIES),
  );
export type GuestList = GuestEntry[];

export function newEntryId(): string {
  return `g${Math.random().toString(36).slice(2, 12).padEnd(6, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Reading a pasted list, in code.                                     */
/* ------------------------------------------------------------------ */

export interface DraftEntry {
  name: string;
  people: number;
  phone: string;
  /** The head count was guessed (e.g. "family" with no number). */
  guessed: boolean;
}

/** Indian mobile numbers, with or without +91 / 0, spaces or dashes. */
const PHONE = /(?:\+?91[\s-]?|0)?[6-9]\d(?:[\s-]?\d){8}\b/;
const COUNT_PATTERNS: RegExp[] = [
  /\((\d{1,2})\)/, // Kapoors (3)
  /\b(?:x|×)\s?(\d{1,2})\b/i, // x3
  /\b(?:approx\.?|approximately|about|around|abt|~)\s*(\d{1,2})\b/i, // approx 12
  /\b(\d{1,2})\s*(?:people|persons|pax|ppl|members|guests|nos?\.?)\b/i, // 4 people
  /(?:^|[\s,:-])[-–:]\s*(\d{1,2})\s*$/, // Sharma family - 4
  /\s(\d{1,2})\s*$/, // Sharma family 4
];

function tidyName(raw: string): string {
  return raw
    .replace(/\b(?:approx\.?|approximately|about|around|abt|people|persons|pax|ppl|members|guests)\b/gi, " ")
    .replace(/[~×]|\bx\b/gi, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/[\s,;:.\-–]+$/u, "")
    .replace(/^[\s,;:.\-–•*\d.)]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reads one line such as "Sharma ji family 4 - 98290 12345" or "Meena aunty + Raj uncle". */
export function parseGuestLine(line: string): DraftEntry | null {
  let text = line.replace(/\t/g, " ").trim();
  if (!text) return null;
  let phone = "";
  const phoneMatch = text.match(PHONE);
  if (phoneMatch) {
    phone = phoneMatch[0].replace(/\s+/g, " ").trim();
    text = text.replace(phoneMatch[0], " ");
  }
  text = text.replace(/[\s,;:\-–]+$/u, "");
  let people = 0;
  for (const pattern of COUNT_PATTERNS) {
    const m = text.match(pattern);
    if (m && Number(m[1]) > 0) {
      people = Math.min(Number(m[1]), MAX_PEOPLE_PER_ENTRY);
      text = text.replace(m[0], " ");
      break;
    }
  }
  const name = tidyName(text)
    .replace(/[^\p{L}\p{M}\p{N}\s.,'&()\-/+]/gu, "")
    .slice(0, 80)
    .trim();
  if (!name || !/\p{L}/u.test(name)) return null;
  let guessed = false;
  if (!people) {
    // No number given: a family or group is a guess (4), a couple is 2, one name is 1.
    const group = /\b(?:family|parivar|parivaar|household|team|gang|group)\b/i.test(name);
    const couple = /\s(?:&|\+|and|aur)\s/i.test(` ${name} `);
    people = group ? 4 : couple ? 2 : 1;
    guessed = group;
  }
  return { name, people, phone, guessed };
}

/** Reads a pasted list: one family or person per line (commas or semicolons also split names). */
export function parseGuestText(text: string): { entries: DraftEntry[]; skipped: string[] } {
  const lines = text
    .split(/\r?\n|;/)
    .flatMap((line) => (PHONE.test(line) || /\d/.test(line) ? [line] : line.split(/,(?![^()]*\))/)))
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: DraftEntry[] = [];
  const skipped: string[] = [];
  for (const line of lines.slice(0, MAX_GUEST_ENTRIES)) {
    const entry = parseGuestLine(line);
    if (entry) entries.push(entry);
    else skipped.push(line);
  }
  return { entries, skipped };
}

/* ------------------------------------------------------------------ */
/* Matching replies from the guest link to the list.                   */
/* ------------------------------------------------------------------ */

const lastTen = (phone: string) => phone.replace(/\D/g, "").slice(-10);
const FILLER = new Set([
  "family",
  "ji",
  "the",
  "and",
  "aur",
  "mr",
  "mrs",
  "ms",
  "dr",
  "shri",
  "smt",
  "uncle",
  "aunty",
  "auntie",
]);
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(" ");
}

/** Pairs each list entry with at most one reply: same phone first, then same or contained name. */
export function matchReplies(entries: GuestList, replies: Reply[]): Map<string, Reply> {
  const out = new Map<string, Reply>();
  const used = new Set<string>();
  const take = (entry: GuestEntry, reply: Reply) => {
    out.set(entry.id, reply);
    used.add(reply.id);
  };
  // Newest reply first, so a changed answer wins.
  const sorted = [...replies].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const entry of entries) {
    const phone = lastTen(entry.phone);
    if (phone.length < 10) continue;
    const reply = sorted.find((r) => !used.has(r.id) && lastTen(r.phone) === phone);
    if (reply) take(entry, reply);
  }
  for (const entry of entries) {
    if (out.has(entry.id)) continue;
    const key = nameKey(entry.name);
    if (key.length < 3) continue;
    const reply =
      sorted.find((r) => !used.has(r.id) && nameKey(r.name) === key) ??
      sorted.find((r) => {
        if (used.has(r.id)) return false;
        const other = nameKey(r.name);
        return other.length >= 4 && (key.includes(other) || other.includes(key));
      });
    if (reply) take(entry, reply);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Status and counts.                                                  */
/* ------------------------------------------------------------------ */

export type EntryStatus = "not-invited" | "invited" | "coming" | "maybe" | "no";
export const STATUS_LABELS: Record<EntryStatus, string> = {
  "not-invited": "Not invited",
  invited: "Invited · no reply",
  coming: "Coming",
  maybe: "Maybe",
  no: "Can't come",
};

export function entryStatus(entry: GuestEntry, reply: Reply | undefined): EntryStatus {
  if (reply) return reply.coming === "yes" ? "coming" : reply.coming;
  return entry.invitedAt ? "invited" : "not-invited";
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Invited, no reply yet, and a week has passed since the invitation or the last reminder. */
export function needsReminder(entry: GuestEntry, reply: Reply | undefined, today: string): boolean {
  if (reply || !entry.invitedAt) return false;
  const last = entry.remindedAt && entry.remindedAt > entry.invitedAt ? entry.remindedAt : entry.invitedAt;
  return daysBetween(last, today) >= REMIND_AFTER_DAYS;
}

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
/* ------------------------------------------------------------------ */

function firstName(name: string): string {
  return name.replace(/\b(?:family|team|gang|group)\b/gi, "").trim() || name;
}

/** The WhatsApp invitation for one family, with the reply link when there is one. */
export function inviteFor(
  entry: GuestEntry,
  base: { title: string; inviteText: string; link: string; when: string },
): string {
  const hello = `Dear ${firstName(entry.name)},`;
  const body = base.inviteText || `You are warmly invited to ${base.title} on ${base.when}.`;
  const ask = base.link ? `Please tell us if you can come, and how many of you: ${base.link}` : "";
  return [hello, body, ask].filter(Boolean).join("\n\n");
}

export function reminderFor(entry: GuestEntry, base: { title: string; link: string; when: string }): string {
  const ask = base.link ? `Could you let us know here: ${base.link}` : "Could you let us know by message?";
  return `Dear ${firstName(entry.name)}, a gentle reminder about ${base.title} on ${base.when}. We'd love to know if you can come and how many of you. ${ask}`;
}

const csvCell = (value: string | number) => {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

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
  return [head, ...lines].map((row) => row.map(csvCell).join(",")).join("\n");
}

/* ------------------------------------------------------------------ */
/* Functions: who on the list is invited, and who is coming.           */
/* ------------------------------------------------------------------ */

/** True when this family is invited to the function (an empty list means every function). */
export function invitedTo(entry: GuestEntry, fn: string): boolean {
  return entry.functions.length === 0 || entry.functions.includes(fn);
}

export interface FunctionCount {
  /** People and families on the list invited to this function. */
  invited: number;
  families: number;
  /** People who replied yes / maybe (their own head count), and families who said no. */
  coming: number;
  maybe: number;
  declined: number;
  /** People on the list with no reply yet. */
  waiting: number;
}

/** Counts for one function, worked out in code from the list and the matched replies. */
export function functionCount(entries: GuestList, replies: Reply[], fn: string): FunctionCount {
  const matched = matchReplies(entries, replies);
  const out: FunctionCount = { invited: 0, families: 0, coming: 0, maybe: 0, declined: 0, waiting: 0 };
  for (const entry of entries) {
    if (!invitedTo(entry, fn)) continue;
    out.families++;
    out.invited += entry.people;
    const reply = matched.get(entry.id);
    if (!reply) out.waiting += entry.people;
    else if (reply.coming === "yes") out.coming += reply.adults + reply.kids;
    else if (reply.coming === "maybe") out.maybe += reply.adults + reply.kids;
    else out.declined++;
  }
  return out;
}

/** True when clearly more people are invited than the plan allows for this function. */
export function overInvited(invited: number, planned: number): boolean {
  return planned > 0 && invited - planned >= 5 && invited >= planned * 1.05;
}
