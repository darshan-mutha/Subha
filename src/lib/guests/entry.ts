import { z } from "zod";
import { isRealDate } from "../dates";
import { ID, localId } from "../ids";
import { GUEST_GROUPS } from "../rsvp";
import { GUEST_NAME_TEXT, nameField, phoneField, validList } from "../validation";

/**
 * One line of the host's guest list: a family or group with a head count,
 * phone, side and the functions they are invited to.
 */

export const MAX_GUEST_ENTRIES = 400;
export const MAX_PEOPLE_PER_ENTRY = 50;
/** Days after an invitation (or a reminder) before Shubā suggests a reminder. */
export const REMIND_AFTER_DAYS = 7;

/** A day something was sent, or "" for not yet. */
const sentOn = () =>
  z
    .union([z.string().refine(isRealDate), z.literal("")])
    .catch("")
    .default("");

export const GuestEntrySchema = z.object({
  id: z.string().regex(ID.guest),
  name: nameField(
    80,
    { empty: "Please enter a name", invalid: "Name can only contain letters and numbers" },
    GUEST_NAME_TEXT,
  ),
  people: z.coerce
    .number({ message: "Please enter how many people" })
    .int("Please enter a whole number")
    .min(1, "At least 1 person")
    .max(MAX_PEOPLE_PER_ENTRY, `Up to ${MAX_PEOPLE_PER_ENTRY} people per entry`),
  phone: phoneField(),
  side: z.enum(GUEST_GROUPS).catch("").default(""),
  /** Function names this family is invited to. Empty means every function. */
  functions: z.array(z.string().trim().min(1).max(60)).max(12).catch([]).default([]),
  /** Day the invitation was sent ("" = not yet). */
  invitedAt: sentOn(),
  remindedAt: sentOn(),
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
