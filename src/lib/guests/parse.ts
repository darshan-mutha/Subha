import { GUEST_NAME_UNSAFE } from "../validation";
import { MAX_GUEST_ENTRIES, MAX_PEOPLE_PER_ENTRY, type DraftEntry } from "./entry";

/**
 * Reading a pasted list, in code. Names and numbers never go to the AI.
 */

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

/**
 * A guest's name as the guest list accepts it: characters the list rejects
 * (emoji, @, markup) removed, spaces tidied, at most 80 characters. Empty when
 * no letter is left. Used for pasted lists and phone contacts alike.
 */
export function cleanGuestName(raw: string): string {
  const name = raw.replace(GUEST_NAME_UNSAFE, "").replace(/\s+/g, " ").slice(0, 80).trim();
  return /\p{L}/u.test(name) ? name : "";
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
  const name = cleanGuestName(tidyName(text));
  if (!name) return null;
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
