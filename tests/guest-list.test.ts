import { describe, expect, it, vi } from "vitest";
import {
  entryStatus,
  GuestListSchema,
  guestListCsv,
  inviteFor,
  listRows,
  listSuggestsGuests,
  listSummary,
  matchReplies,
  needsReminder,
  parseGuestLine,
  parseGuestText,
  reminderFor,
  rowMatches,
  type GuestEntry,
} from "@/lib/guestList";
import { scaleGroups, standardGroups, suggestGuestGroups, buildGroupsPrompt } from "@/lib/guestGroups";
import type { Reply } from "@/lib/rsvp";
import { makeSharedContentSchema } from "@/lib/team";
import { baseInput, samplePlan } from "./fixtures";

const entry = (over: Partial<GuestEntry> = {}): GuestEntry => ({
  id: `g${Math.random().toString(36).slice(2, 9)}`,
  name: "Sharma family",
  people: 4,
  phone: "",
  side: "",
  functions: [],
  invitedAt: "",
  remindedAt: "",
  ...over,
});
const reply = (over: Partial<Reply> = {}): Reply => ({
  id: `r${Math.random().toString(36).slice(2, 9)}`,
  name: "Someone",
  phone: "",
  coming: "yes",
  adults: 2,
  kids: 0,
  food: "any",
  needs: [],
  group: "",
  note: "",
  createdAt: "2026-10-26T00:00:00Z",
  updatedAt: "2026-10-26T00:00:00Z",
  ...over,
});

describe("reading a pasted list", () => {
  it.each([
    ["Sharma ji family 4 - 98290 12345", { name: "Sharma ji family", people: 4, phone: "98290 12345", guessed: false }],
    ["Meena aunty + Raj uncle", { name: "Meena aunty + Raj uncle", people: 2, guessed: false }],
    ["Rohan office team approx 12", { name: "Rohan office team", people: 12 }],
    ["Kapoors (3)", { name: "Kapoors", people: 3 }],
    ["1. Suresh Mama & family", { name: "Suresh Mama & family", people: 4, guessed: true }],
    ["+91 98450-11223 Priya", { name: "Priya", people: 1, phone: "+91 98450-11223" }],
    ["Gupta parivar x5", { name: "Gupta parivar", people: 5 }],
    ["Ramesh bhaiya 2 people", { name: "Ramesh bhaiya", people: 2 }],
    ["सुनीता दीदी (3)", { name: "सुनीता दीदी", people: 3 }],
  ])("%s", (line, expected) => {
    expect(parseGuestLine(line)).toMatchObject(expected);
  });

  it("splits lines and plain comma lists, and skips lines without a name", () => {
    const { entries, skipped } = parseGuestText("Anil, Sunita, Deepak\n--\n\nKapoors (3); Mehta 2");
    expect(entries.map((e) => e.name)).toEqual(["Anil", "Sunita", "Deepak", "Kapoors", "Mehta"]);
    expect(skipped).toEqual(["--"]);
  });

  it("caps very big numbers and strips markup characters", () => {
    expect(parseGuestLine("Village (99)")?.people).toBe(50);
    expect(parseGuestLine("<script>Raj</script>")?.name).not.toMatch(/[<>]/);
  });
});

describe("matching replies to the list", () => {
  it("matches by phone first, then by name, each reply once", () => {
    const a = entry({ name: "Sharma family", phone: "98290 12345" });
    const b = entry({ name: "Meena aunty & Raj uncle" });
    const c = entry({ name: "Kapoor family" });
    const replies = [
      reply({ name: "Vikram Sharma", phone: "+91 98290-12345" }),
      reply({ name: "Meena aunty", coming: "maybe" }),
      reply({ name: "Unknown person" }),
    ];
    const m = matchReplies([a, b, c], replies);
    expect(m.get(a.id)?.name).toBe("Vikram Sharma");
    expect(m.get(b.id)?.name).toBe("Meena aunty");
    expect(m.has(c.id)).toBe(false);
  });

  it("works out status, reminders and counts", () => {
    const invited = entry({ invitedAt: "2026-10-10" });
    const recentReminder = entry({ invitedAt: "2026-10-10", remindedAt: "2026-10-24" });
    expect(entryStatus(entry(), undefined)).toBe("not-invited");
    expect(entryStatus(invited, undefined)).toBe("invited");
    expect(entryStatus(invited, reply({ coming: "no" }))).toBe("no");
    expect(needsReminder(invited, undefined, "2026-10-26")).toBe(true);
    expect(needsReminder(recentReminder, undefined, "2026-10-26")).toBe(false);
    expect(needsReminder(invited, reply(), "2026-10-26")).toBe(false);

    const list = [
      entry({ name: "Sharma family", invitedAt: "2026-10-10", side: "bride" }),
      entry({ name: "Kapoor family", people: 3, invitedAt: "2026-10-10", side: "groom" }),
      entry({ name: "Office", people: 12 }),
    ];
    const rows = listRows(list, [reply({ name: "Sharma family", adults: 3, kids: 2 })], "2026-10-26");
    const s = listSummary(rows);
    expect(s).toMatchObject({
      families: 3,
      people: 19,
      invited: 2,
      noReply: 1,
      notInvited: 1,
      comingPeople: 5,
      remind: 1,
    });
    expect(rows.filter((r) => rowMatches(r, "side:groom")).map((r) => r.entry.name)).toEqual(["Kapoor family"]);
    expect(rows.filter((r) => rowMatches(r, "remind")).map((r) => r.entry.name)).toEqual(["Kapoor family"]);
  });

  it("suggests updating the plan only for a clear gap", () => {
    expect(listSuggestsGuests(37, 250, 9, false)).toBeNull(); // still building the list
    expect(listSuggestsGuests(220, 250, 96, true)).toBe(220); // finished and smaller
    expect(listSuggestsGuests(300, 250, 96, false)).toBe(300); // bigger than planned
    expect(listSuggestsGuests(238, 250, 96, true)).toBeNull(); // within 5%
    expect(listSuggestsGuests(400, 250, 3, true)).toBeNull(); // too few families yet
  });
});

describe("messages and files", () => {
  const base = { title: "Ananya & Rohan's wedding", link: "https://x/r/T", when: "23 February 2027", inviteText: "" };
  it("writes a personal invitation and reminder with the reply link", () => {
    const text = inviteFor(entry({ name: "Sharma family" }), base);
    expect(text).toMatch(/^Dear Sharma,/);
    expect(text).toContain("https://x/r/T");
    expect(inviteFor(entry(), { ...base, link: "", inviteText: "Card words" })).toBe("Dear Sharma,\n\nCard words");
    expect(reminderFor(entry(), base)).toContain("gentle reminder");
  });

  it("makes a safe spreadsheet", () => {
    const csv = guestListCsv(listRows([entry({ name: "=HYPERLINK(x)" })], [], "2026-10-26"));
    expect(csv.split("\n")[0]).toContain("Name,People,Phone");
    expect(csv).toContain("'=HYPERLINK(x)");
  });
});

describe("saving with the plan", () => {
  it("drops damaged entries and keeps the rest; old plans get an empty list", () => {
    expect(GuestListSchema.parse([entry({ name: "Ok" }), { id: "bad" }, "x"])).toHaveLength(1);
    const content = { input: baseInput, plan: samplePlan, timings: null, team: [], assignments: {} };
    expect(makeSharedContentSchema().parse(content).guestList).toEqual([]);
    expect(makeSharedContentSchema().parse({ ...content, guestList: [entry()] }).guestList).toHaveLength(1);
  });
});

describe("help me build it", () => {
  it("scales group numbers to the planned total", () => {
    const groups = scaleGroups(standardGroups({ ...baseInput, eventType: "wedding", guests: 250 }).groups, 250);
    expect(groups.reduce((s, g) => s + g.about, 0)).toBe(250);
    expect(groups.some((g) => g.side === "bride")).toBe(true);
    expect(standardGroups(baseInput).groups[0].name).toBe("Child's friends");
  });

  it("sends only the kind of event and numbers, and falls back when the AI is busy", async () => {
    const request = { input: { ...baseInput, guests: 120 }, functions: ["Mehndi", "Wedding"] };
    expect(buildGroupsPrompt(request)).toContain("Planned guests: 120");
    const generate = vi.fn(async () =>
      JSON.stringify({
        groups: [
          { name: "Family", about: 60, who: "Close family", side: "family" },
          { name: "Friends", about: 30, who: "School friends", side: "friends" },
          { name: "", about: 5, who: "", side: "x" },
        ],
        reminders: ["Helpers need food too"],
      }),
    );
    const ai = await suggestGuestGroups(request, generate);
    expect(ai.source).toBe("ai");
    expect(ai.groups.map((g) => g.about)).toEqual([80, 40]);
    const busy = await suggestGuestGroups(
      request,
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    expect(busy.source).toBe("standard");
  });
});
