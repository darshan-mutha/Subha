import type { Reply } from "../rsvp";
import type { GuestEntry, GuestList } from "./entry";
import { matchReplies } from "./match";

/** Functions: who on the list is invited to each, and who is coming. */

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
