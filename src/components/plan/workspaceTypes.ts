import type { ReactNode } from "react";
import type { LocalWorkspace } from "@/lib/client";
import type { SharedPlanContent } from "@/lib/team";

/** Props of the plan screen (PlanWorkspace). */
export interface PlanWorkspaceProps {
  data: LocalWorkspace;
  /** Identifies the plan on this device, for remembering which milestone moments have played. */
  planKey: string;
  shareUrl: string | null;
  /** The shared plan's id (for guest replies), or null while the plan is only on this device. */
  planId?: string | null;
  /** Tab to open first, e.g. "guests" after getting the guest link. */
  initialTab?: string;
  /** Saves changes to plan content (team, owners, refined plan). */
  onChange: (content: Partial<SharedPlanContent>) => Promise<void>;
  onToggle: (itemId: string, done: boolean) => void;
  /** Saves the plan online for the team. `openTab` is the tab to show once it opens. */
  onShare: ((openTab?: string) => Promise<void>) | null;
  onEdit: (() => void) | null;
  onStartOver: () => void;
  /** Opens the list of events on this device. */
  onMyEvents?: () => void;
  /** How many events are on this device, shown on the My events button. */
  eventCount?: number;
  viewer: string;
  onViewerChange: (memberId: string) => void;
  /** Message from the parent, e.g. "Saved" or a sync problem. */
  notice?: string;
}

/** The plan as it was before the last change, so the host can undo it. */
export type Snapshot = Partial<SharedPlanContent>;

/** The last change shown in "What changed", with what to restore on Undo. */
export interface LastChange {
  lines: string[];
  before: Snapshot;
  note: string;
}

/** Runs a save with busy state and announcements; resolves to whether it worked. */
export type Act = (task: () => Promise<void>, working: string, doneMessage: string) => Promise<boolean>;

/** One section of the plan screen (Home, Budget, Guests…) and what it shows. */
export interface SectionItem {
  id: string;
  label: string;
  content: ReactNode;
}
