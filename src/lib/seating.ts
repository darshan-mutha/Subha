import { z } from "zod";
import { GUEST_FOOD_LABELS, GUEST_GROUP_LABELS, type GuestFood, type GuestGroup, type Reply } from "./rsvp";

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
 */

export const TABLE_SIZES = [6, 8, 10, 12] as const;
export const MAX_TABLES = 400;

const ReplyRef = z.string().regex(/^r[a-z0-9]{6,16}$/);

export const SeatingSchema = z.object({
  tableSize: z.coerce
    .number()
    .int()
    .refine((n) => (TABLE_SIZES as readonly number[]).includes(n))
    .catch(8)
    .default(8),
  includeMaybe: z.boolean().catch(false).default(false),
  /** Families the host moved: reply id → table number. */
  moves: z.record(ReplyRef, z.number().int().min(1).max(MAX_TABLES)).catch({}).default({}),
});
export type Seating = z.infer<typeof SeatingSchema>;
export const DEFAULT_SEATING: Seating = { tableSize: 8, includeMaybe: false, moves: {} };

export interface Seat {
  replyId: string;
  name: string;
  people: number;
  /** "1 of 2" when a big family fills more than one table. */
  part?: string;
  food: GuestFood;
  group: GuestGroup;
  maybe: boolean;
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
}

interface Party {
  reply: Reply;
  people: number;
  access: boolean;
}

const isAccess = (r: Reply) => r.needs.includes("elderly") || r.needs.includes("wheelchair");

function seatOf(p: Party, people: number, part?: string): Seat {
  return {
    replyId: p.reply.id,
    name: p.reply.name,
    people,
    part,
    food: p.reply.food,
    group: p.reply.group,
    maybe: p.reply.coming === "maybe",
    access: p.access,
    kids: p.reply.kids,
    moved: false,
  };
}

const used = (seats: Seat[]) => seats.reduce((s, x) => s + x.people, 0);

/** Places parties into tables, biggest first, each into the first table with room. */
function pack(parties: Party[], size: number): Seat[][] {
  const tables: Seat[][] = [];
  for (const p of [...parties].sort((a, b) => b.people - a.people || a.reply.name.localeCompare(b.reply.name))) {
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
  for (const s of seats) food.set(s.food, (food.get(s.food) ?? 0) + s.people);
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

export function planSeating(replies: Reply[], seating: Seating = DEFAULT_SEATING): SeatingPlan {
  const size = seating.tableSize;
  const parties: Party[] = replies
    .filter((r) => r.coming === "yes" || (seating.includeMaybe && r.coming === "maybe"))
    .map((r) => ({ reply: r, people: r.adults + r.kids, access: isAccess(r) }))
    .filter((p) => p.people > 0);

  // 1. Each side packs into its own tables.
  const bySide = new Map<GuestGroup, Party[]>();
  for (const p of parties) bySide.set(p.reply.group, [...(bySide.get(p.reply.group) ?? []), p]);
  const sideOrder = [...bySide.keys()].sort((a, b) => (a === "" ? 1 : 0) - (b === "" ? 1 : 0) || a.localeCompare(b));
  let tables: Seat[][] = [];
  const leftovers: Party[] = [];
  for (const side of sideOrder) {
    const packed = pack(bySide.get(side)!, size);
    // 2. A side's last half-empty table is merged with other small groups.
    const last = packed.at(-1);
    if (packed.length > 0 && last && !last.some((s) => s.part) && used(last) <= size / 2) {
      packed.pop();
      for (const seat of last) leftovers.push(parties.find((p) => p.reply.id === seat.replyId)!);
    }
    tables.push(...packed);
  }
  tables.push(...pack(leftovers, size));

  // 3. Tables with elderly or wheelchair guests go nearest the entrance.
  tables = [...tables.filter((t) => t.some((s) => s.access)), ...tables.filter((t) => !t.some((s) => s.access))];

  // 4. The host's moves. A moved family goes to that table, which may be a new one.
  const moved = Object.entries(seating.moves).filter(([id]) => parties.some((p) => p.reply.id === id));
  if (moved.length) {
    for (const [id, number] of moved) {
      const seats = tables.flatMap((t) => t.filter((s) => s.replyId === id));
      if (seats.some((s) => s.part)) continue; // a family spread over tables is not moved
      tables = tables.map((t) => t.filter((s) => s.replyId !== id));
      while (tables.length < number) tables.push([]);
      tables[number - 1].push(...seats.map((s) => ({ ...s, moved: true })));
    }
    // Drop empty tables at the end. Empty tables in between keep their numbers, so moves stay put.
    while (tables.length && tables.at(-1)!.length === 0) tables.pop();
  }

  const described = tables.map((seats, i) => describe(seats, i + 1, size));
  return {
    tables: described,
    people: described.reduce((s, t) => s + t.people, 0),
    families: parties.length,
  };
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
    const who = t.seats.map((s) => `${s.name} (${s.people}${s.part ? `, ${s.part}` : ""})`).join(", ");
    const near = t.nearEntrance ? " – near the entrance, step-free" : "";
    return `Table ${t.number}${near}: ${who || "empty"}`;
  });
  return [`Seating for ${title}`, ...lines].join("\n");
}
