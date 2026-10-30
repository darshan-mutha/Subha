import { memberMessage, type Assignments, type Done, type Member, type PlanItem } from "@/lib/team";
import { dueText, type ScheduledItem } from "@/lib/schedule";

/** One helper's task counts and the WhatsApp message listing what is left for them. */
export interface MemberSummary {
  member: Member;
  total: number;
  finished: number;
  /** Empty until the plan has a share link. */
  message: string;
}

/** Counts across the whole plan, for the progress bar and the divide button. */
export interface TeamTotals {
  total: number;
  done: number;
  unassigned: number;
}

/** True when a plan item carries a due date and status (a scheduled item). */
export function isScheduled(item: PlanItem): item is ScheduledItem {
  return "due" in item && "status" in item;
}

/** How many items are done and how many have nobody assigned yet. */
export function teamTotals(items: PlanItem[], assignments: Assignments, done: Done): TeamTotals {
  return {
    total: items.length,
    done: items.filter((i) => done[i.id]).length,
    unassigned: items.filter((i) => !assignments[i.id]).length,
  };
}

/** Per-member counts plus the message of their pending tasks (with due labels when today is known). */
export function memberSummaries(opts: {
  team: Member[];
  items: PlanItem[];
  assignments: Assignments;
  done: Done;
  eventTitle: string;
  shareUrl: string | null;
  today?: string;
}): MemberSummary[] {
  const { team, items, assignments, done, eventTitle, shareUrl, today } = opts;
  return team.map((member) => {
    const mine = items.filter((i) => assignments[i.id] === member.id);
    const finished = mine.filter((i) => done[i.id]).length;
    const pending = mine
      .filter((i) => !done[i.id])
      .map((i) => ({ ...i, dueLabel: today && isScheduled(i) ? dueText(i, today) : undefined }));
    const message = shareUrl ? memberMessage(member, pending, eventTitle, shareUrl) : "";
    return { member, total: mine.length, finished, message };
  });
}
