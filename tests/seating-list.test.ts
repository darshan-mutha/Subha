import { describe, expect, it } from "vitest";
import type { GuestEntry } from "@/lib/guestList";
import { functionCount, invitedTo, overInvited } from "@/lib/guestList";
import type { Reply } from "@/lib/rsvp";
import { DEFAULT_SEATING, planSeating, SeatingSchema, seatingText } from "@/lib/seating";

let n = 0;
const entry = (name: string, people: number, over: Partial<GuestEntry> = {}): GuestEntry => ({
  id: `g${String(++n).padStart(6, "0")}`,
  name,
  people,
  phone: "",
  side: "",
  functions: [],
  invitedAt: "",
  remindedAt: "",
  ...over,
});
const reply = (name: string, adults: number, over: Partial<Reply> = {}): Reply => ({
  id: `r${String(++n).padStart(6, "0")}`,
  name,
  phone: "",
  coming: "yes",
  adults,
  kids: 0,
  food: "jain",
  needs: [],
  group: "",
  note: "",
  createdAt: "",
  updatedAt: "2026-10-28",
  ...over,
});

const seated = (plan: ReturnType<typeof planSeating>) =>
  plan.tables.flatMap((t) => t.seats.map((s) => `${s.name}${s.waiting ? "?" : ""}`)).sort();

describe("seating from the guest list", () => {
  const list = [
    entry("Sharma family", 4, { side: "bride", phone: "98290 12345" }),
    entry("Kapoor family", 3, { side: "groom", functions: ["Sangeet"] }),
    entry("Mehta family", 5, { side: "bride" }),
    entry("Gupta family", 2),
  ];
  const replies = [
    reply("Mrs Sharma", 3, { phone: "+91 98290 12345", needs: ["elderly"] }), // matched by phone, 3 not 4
    reply("Mehta", 0, { coming: "no" }),
    reply("Rao (not on list)", 2),
  ];

  it("seats everyone on the list before they reply, except those who said no", () => {
    const plan = planSeating(replies, DEFAULT_SEATING, list);
    expect(seated(plan)).toEqual(["Gupta family?", "Kapoor family?", "Rao (not on list)", "Sharma family"]);
    expect(plan.people).toBe(3 + 3 + 2 + 2);
    expect(plan.waiting).toBe(5);
    expect(plan.replied).toBe(5);
    // The reply gives the head count, food and needs; the list gives the name and side.
    const sharma = plan.tables.flatMap((t) => t.seats).find((s) => s.name === "Sharma family")!;
    expect(sharma).toMatchObject({ people: 3, food: "jain", group: "bride", access: true, waiting: false });
    expect(plan.tables[0].nearEntrance).toBe(true);
  });

  it("can seat only those coming", () => {
    const plan = planSeating(replies, { ...DEFAULT_SEATING, from: "replies" }, list);
    expect(seated(plan)).toEqual(["Rao (not on list)", "Sharma family"]);
    expect(plan.waiting).toBe(0);
  });

  it("seats one function at a time", () => {
    const sangeet = planSeating(replies, { ...DEFAULT_SEATING, fn: "Sangeet" }, list);
    expect(seated(sangeet)).toContain("Kapoor family?");
    const pheras = planSeating(replies, { ...DEFAULT_SEATING, fn: "Pheras" }, list);
    expect(seated(pheras)).not.toContain("Kapoor family?");
    expect(seated(pheras)).toContain("Gupta family?");
  });

  it("leaves food out of the table line for families with no reply yet", () => {
    const plan = planSeating([], { ...DEFAULT_SEATING, tableSize: 12 }, [entry("A", 4), entry("B", 4)]);
    expect(plan.tables[0].food).toEqual([]);
    expect(seatingText("Test", plan)).toContain("A (4, no reply yet)");
  });

  it("lets the host move a family from the list, kept by its list id", () => {
    const a = entry("A", 4);
    const b = entry("B", 3);
    const plan = planSeating([], { ...DEFAULT_SEATING, moves: { [b.id]: 2 } }, [a, b]);
    expect(plan.tables[1].seats.map((s) => s.name)).toEqual(["B"]);
    expect(SeatingSchema.parse({ moves: { [b.id]: 2 } }).moves).toEqual({ [b.id]: 2 });
  });

  it("keeps old saved seating working", () => {
    expect(SeatingSchema.parse({ tableSize: 10, includeMaybe: true, moves: {} })).toMatchObject({
      from: "list",
      fn: "",
    });
    expect(SeatingSchema.parse({ from: "everyone", fn: 5 })).toMatchObject({ from: "list", fn: "" });
  });
});

describe("counts per function", () => {
  it("counts invited, coming, maybe, said no and no reply", () => {
    const list = [
      entry("Sharma family", 4, { phone: "9829012345" }),
      entry("Kapoor family", 3, { functions: ["Sangeet"] }),
      entry("Mehta family", 5, { functions: ["Reception"] }),
      entry("Gupta family", 2),
    ];
    const replies = [
      reply("Sharma", 3, { phone: "9829012345" }),
      reply("Kapoor", 2, { coming: "maybe" }),
      reply("Gupta", 0, { coming: "no" }),
    ];
    expect(invitedTo(list[1], "Sangeet")).toBe(true);
    expect(invitedTo(list[1], "Reception")).toBe(false);
    expect(functionCount(list, replies, "Sangeet")).toEqual({
      invited: 9,
      families: 3,
      coming: 3,
      maybe: 2,
      declined: 1,
      waiting: 0,
    });
    expect(functionCount(list, replies, "Reception")).toMatchObject({ invited: 11, coming: 3, waiting: 5 });
  });

  it("warns only when clearly more are invited than planned", () => {
    expect(overInvited(196, 180)).toBe(true);
    expect(overInvited(183, 180)).toBe(false);
    expect(overInvited(50, 0)).toBe(false);
  });
});
