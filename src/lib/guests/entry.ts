import { z } from "zod";
import { localId } from "../ids";
import { GUEST_GROUPS } from "../rsvp";
import { validList } from "../validation";

/**
 * One line of the host's guest list: a family or group with a head count,
 * phone, side and the functions they are invited to.
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
export const GuestListSchema = validList(GuestEntrySchema, MAX_GUEST_ENTRIES);
export type GuestList = GuestEntry[];

export function newEntryId(): string {
  return localId("g");
}

/** A line read from pasted text, before it becomes an entry. */
export interface DraftEntry {
  name: string;
  people: number;
  phone: string;
  /** The head count was guessed (e.g. "family" with no number). */
  guessed: boolean;
}
