import type { ScheduledItem } from "@/lib/schedule";
import type { Assignments, Done, Member } from "@/lib/team";

/** Shared task state: ticks and owners, controlled by the workspace. */
export interface TaskState {
  done: Done;
  onToggle: (itemId: string, done: boolean) => void;
  team: Member[];
  assignments: Assignments;
  onAssign: (itemId: string, memberId: string) => void;
  /** When set, only this person's items are shown. */
  viewer: string;
  /** Today's date (YYYY-MM-DD, India), for due-date labels. */
  today: string;
  /** Event date (YYYY-MM-DD). With onDelay, tasks can be marked as running late. */
  eventDate?: string;
  /** Moves a late task, and the tasks after it, by this many days. */
  onDelay?: (item: ScheduledItem, days: number) => void;
}
