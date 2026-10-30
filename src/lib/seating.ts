import { z } from "zod";
import { ID } from "./ids";
import { GUEST_FOOD_LABELS, GUEST_GROUP_LABELS, type GuestFood, type GuestGroup, type Reply } from "./rsvp";
import { invitedTo, matchReplies, type GuestList } from "./guestList";

/**
 * Seating suggestions from guest replies, worked out in code so they are
 * instant, free and the same every time:
 * - a family always sits together (a family bigger than a table fills
 *   tables side by side);
 * - each side (bride's, groom's, friends, work…) sits together, and small
 *   leftover groups share tables;
 * - families with an elderly person or a wheelchair user get the tables
 *   nearest the entrance, with a step-free path;
 * - the host can move any family to another table.
 *
 * With a guest list, families can be seated before they reply ("no reply
 * yet"), and one function can be seated at a time (only the families invited
 * to it). Families who said no are always left out.
 */

export const TABLE_SIZES = [6, 8, 10, 12] as const;
export const MAX_TABLES = 400;

/** A reply id (r…) or a guest-list entry id (g…). */
const PartyRef = z.string().regex(ID.party);

export const SEAT_FROM = ["list", "replies"] as const;
export type SeatFrom = (typeof SEAT_FROM)[number];

export const SeatingSchema = z.object({
  tableSize: z.coerce
    .number()
    .int()
    .refine((n) => (TABLE_SIZES as readonly number[]).includes(n))
    .catch(8)
    .default(8),
  includeMaybe: z.boolean().catch(false).default(false),
  /** "list": everyone on the guest list (not only those who replied); "replies": only those coming. */
  from: z.enum(SEAT_FROM).catch("list").default("list"),
  /** Function being seated ("" = all functions). */
  fn: z.string().trim().max(60).catch("").default(""),
  /** Families the host moved: reply or guest-list id → table number. */
  moves: z.record(PartyRef, z.number().int().min(1).max(MAX_TABLES)).catch({}).default({}),
});
export type Seating = z.infer<typeof SeatingSchema>;
export const DEFAULT_SEATING: Seating = { tableSize: 8, includeMaybe: false, from: "list", fn: "", moves: {} };

export interface Seat {
  replyId: string;
  name: string;
  people: number;
  /** "1 of 2" when a big family fills more than one table. */
  part?: string;
  food: GuestFood;
  group: GuestGroup;
  maybe: boolean;
  /** On the guest list but has not replied yet: food and needs are not known. */
  waiting: boolean;
  access: boolean;
  kids: number;
  moved: boolean;
}

export interface Table {
  number: number;
  seats: Seat[];
  people: number;
  /** People over the table size (only after the host moves families). */
  over: number;
  nearEntrance: boolean;
  groups: GuestGroup[];
  food: { food: GuestFood; people: number }[];
  kids: number;
}

export interface SeatingPlan {
  tables: Table[];
  people: number;
  families: number;
  /** People who said yes (or maybe, when kept) and people with no reply yet. */
  replied: number;
  waiting: number;
}

interface Party {
  id: string;
  name: string;
  people: number;
  food: GuestFood;
  group: GuestGroup;
  maybe: boolean;
  waiting: boolean;
  access: boolean;
  kids: number;
}

const isAccess = (r: Reply) => r.needs.includes("elderly") || r.needs.includes("wheelchair");

function fromReply(r: Reply, id = r.id, name = r.name, side: GuestGroup = ""): Party {
  return {
    id,
    name,
    people: r.adults + r.kids,
    food: r.food,
    group: r.group || side,
    maybe: r.coming === "maybe",
    waiting: false,
    access: isAccess(r),
    kids: r.kids,
  };
}

/**
 * Who gets a seat. With a guest list (and "list"), every family on it except
 * those who said no; their reply, if any, gives the head count, food and needs.
 * Replies that match nobody on the list are seated too.
 */
function partiesFor(replies: Reply[], seating: Seating, entries: GuestList): Party[] {
  const counts = (r: Reply) => r.coming === "yes" || (seating.includeMaybe && r.coming === "maybe");
  const matched = matchReplies(entries, replies);
  const usedReplies = new Set([...matched.values()].map((r) => r.id));
  const out: Party[] = [];
  for (const entry of entries) {
    if (seating.fn && !invitedTo(entry, seating.fn)) continue;
    const reply = matched.get(entry.id);
    if (reply) {
      if (counts(reply)) out.push(fromReply(reply, entry.id, entry.name, entry.side));
    } else if (seating.from === "list") {
      out.push({
        id: entry.id,
        name: entry.name,
        people: entry.people,
        food: "any",
        group: entry.side,
        maybe: false,
        waiting: true,
        access: false,
        kids: 0,
      });
    }
  }
  for (const r of replies) if (!usedReplies.has(r.id) && counts(r)) out.push(fromReply(r));
  return out.filter((p) => p.people > 0);
}

function seatOf(p: Party, people: number, part?: string): Seat {
  return {
    replyId: p.id,
    name: p.name,
    people,
    part,
    food: p.food,
    group: p.group,
    maybe: p.maybe,
    waiting: p.waiting,
    access: p.access,
    kids: p.kids,
    moved: false,
  };
}

const used = (seats: Seat[]) => seats.reduce((s, x) => s + x.people, 0);

/** Places parties into tables, biggest first, each into the first table with room. */
function pack(parties: Party[], size: number): Seat[][] {
  const tables: Seat[][] = [];
  for (const p of [...parties].sort((a, b) => b.people - a.people || a.name.localeCompare(b.name))) {
    if (p.people > size) {
      // A big family fills tables side by side, split evenly (9 at tables of 8 → 5 and 4).
      const parts = Math.ceil(p.people / size);
      const base = Math.floor(p.people / parts);
      const extra = p.people % parts;
      for (let i = 1; i <= parts; i++) {
        tables.push([seatOf(p, base + (i <= extra ? 1 : 0), `${i} of ${parts}`)]);
      }
      continue;
    }
    const table = tables.find((t) => !t.some((s) => s.part) && used(t) + p.people <= size);
    if (table) table.push(seatOf(p, p.people));
    else tables.push([seatOf(p, p.people)]);
  }
  return tables;
}

function describe(seats: Seat[], number: number, size: number): Table {
  const people = used(seats);
  const food = new Map<GuestFood, number>();
  // Families who have not replied have no known food choice.
  for (const s of seats) if (!s.waiting) food.set(s.food, (food.get(s.food) ?? 0) + s.people);
  return {
    number,
    seats,
    people,
    over: Math.max(0, people - size),
    nearEntrance: seats.some((s) => s.access),
    groups: [...new Set(seats.map((s) => s.group))],
    food: [...food].map(([f, n]) => ({ food: f, people: n })).sort((a, b) => b.people - a.people),
    kids: seats.reduce((s, x) => s + x.kids, 0),
  };
}

export function planSeating(
  replies: Reply[],
  seating: Seating = DEFAULT_SEATING,
  entries: GuestList = [],
): SeatingPlan {
  const size = seating.tableSize;
  const parties = partiesFor(replies, seating, entries);

  // 1. Each side packs into its own tables.
  const bySide = new Map<GuestGroup, Party[]>();
  for (const p of parties) bySide.set(p.group, [...(bySide.get(p.group) ?? []), p]);
  // Named sides first (alphabetically), guests with no side last.
  const sides = [...bySide.entries()].sort(([a], [b]) => (a === "" ? 1 : 0) - (b === "" ? 1 : 0) || a.localeCompare(b));
  const byId = new Map(parties.map((p) => [p.id, p]));
  let tables: Seat[][] = [];
  const leftovers: Party[] = [];
  for (const [, sideParties] of sides) {
    const packed = pack(sideParties, size);
    // 2. A side's last half-empty table is merged with other small groups.
    const last = packed.at(-1);
    if (last && !last.some((s) => s.part) && used(last) <= size / 2) {
      packed.pop();
      for (const seat of last) {
        const party = byId.get(seat.replyId);
        if (party) leftovers.push(party);
      }
    }
    tables.push(...packed);
  }
  tables.push(...pack(leftovers, size));

  // 3. Tables with elderly or wheelchair guests go nearest the entrance.
  tables = [...tables.filter((t) => t.some((s) => s.access)), ...tables.filter((t) => !t.some((s) => s.access))];

  // 4. The host's moves. A moved family goes to that table, which may be a new one.
  const moved = Object.entries(seating.moves).filter(([id]) => parties.some((p) => p.id === id));
  if (moved.length) {
    for (const [id, number] of moved) {
      const seats = tables.flatMap((t) => t.filter((s) => s.replyId === id));
      if (seats.some((s) => s.part)) continue; // a family spread over tables is not moved
      tables = tables.map((t) => t.filter((s) => s.replyId !== id));
      while (tables.length < number) tables.push([]);
      tables[number - 1].push(...seats.map((s) => ({ ...s, moved: true })));
    }
    // Drop empty tables at the end. Empty tables in between keep their numbers, so moves stay put.
    while (tables.at(-1)?.length === 0) tables.pop();
  }

  const described = tables.map((seats, i) => describe(seats, i + 1, size));
  const waiting = parties.filter((p) => p.waiting).reduce((s, p) => s + p.people, 0);
  const people = described.reduce((s, t) => s + t.people, 0);
  return { tables: described, people, families: parties.length, replied: people - waiting, waiting };
}

/** Short line about a table, e.g. "Bride's side · Veg 6, Jain 2". */
export function tableLine(table: Table): string {
  const sides = table.groups.filter((g) => g !== "").map((g) => GUEST_GROUP_LABELS[g]);
  const food = table.food.map((f) => `${GUEST_FOOD_LABELS[f.food]} ${f.people}`);
  return [sides.join(", "), food.join(", ")].filter(Boolean).join(" · ");
}

/** The seating plan as plain text, for WhatsApp or the venue. */
export function seatingText(title: string, plan: SeatingPlan): string {
  const lines = plan.tables.map((t) => {
    const who = t.seats
      .map((s) => `${s.name} (${s.people}${s.part ? `, ${s.part}` : ""}${s.waiting ? ", no reply yet" : ""})`)
      .join(", ");
    const near = t.nearEntrance ? " – near the entrance, step-free" : "";
    return `Table ${t.number}${near}: ${who || "empty"}`;
  });
  return [`Seating for ${title}`, ...lines].join("\n");
}
