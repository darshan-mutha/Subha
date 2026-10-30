"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import type { GuestList as Entries } from "@/lib/guestList";
import { GuestList } from "./GuestList";
import { GuestsSection } from "./GuestsSection";
import { SeatingSection } from "./SeatingSection";
import type { Replies } from "./useReplies";
import { TabPanel, ViewTabs, type ViewTab } from "./ViewTabs";
import { DEFAULT_SEATING, type Seating } from "@/lib/seating";

type Part = "list" | "replies" | "seating";
const PARTS: ViewTab<Part>[] = [
  { id: "list", label: "Guest list" },
  { id: "replies", label: "Replies" },
  { id: "seating", label: "Seating" },
];

type SectionProps = ComponentProps<typeof GuestsSection>;

interface Props extends SectionProps {
  /** Guest replies, loaded once for the whole section (see usePlanTabs). */
  replies: Replies;
  seating?: Seating;
  onSeating: (next: Seating) => void;
  entries: Entries;
  functions: string[];
  today: string;
  onList: (next: Entries) => void;
  /** Part to open first: "replies" right after getting the guest link. */
  initialPart?: Part;
}

/** The Guests section: the host's guest list, the replies from the guest link, and seating. */
export function GuestsHub({
  entries,
  functions,
  today,
  onList,
  initialPart = "list",
  seating,
  onSeating,
  ...section
}: Props) {
  const [part, setPart] = useState<Part>(initialPart);
  const base = useId();
  const { replies, error } = section.replies;
  const views: Record<Part, () => ReactNode> = {
    list: () => (
      <GuestList
        entries={entries}
        planId={section.planId}
        replies={section.replies}
        input={section.input}
        title={section.title}
        invite={section.invite}
        functions={functions}
        today={today}
        busy={section.busy}
        onChange={onList}
        onUseGuests={(guests) => section.onUseGuests(guests)}
        onShowReplies={() => setPart("replies")}
      />
    ),
    seating: () => (
      <>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <SeatingSection
          replies={replies}
          entries={entries}
          functions={functions}
          seating={seating ?? DEFAULT_SEATING}
          title={section.title}
          onChange={onSeating}
        />
      </>
    ),
    replies: () => <GuestsSection {...section} />,
  };
  return (
    <>
      <h2 className="section-title">Guests</h2>
      <ViewTabs
        base={base}
        label="Guests"
        className="segmented no-print"
        items={PARTS}
        current={part}
        onSelect={setPart}
      />
      <TabPanel base={base} id={part}>
        {views[part]()}
      </TabPanel>
    </>
  );
}
