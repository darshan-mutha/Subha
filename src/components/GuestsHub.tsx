"use client";

import { useState, type ComponentProps } from "react";
import type { GuestList as Entries } from "@/lib/guestList";
import { GuestList } from "./GuestList";
import { GuestsSection } from "./GuestsSection";
import { SeatingSection } from "./SeatingSection";
import type { Replies } from "./useReplies";
import { DEFAULT_SEATING } from "@/lib/seating";

type Part = "list" | "replies" | "seating";
const PARTS: { id: Part; label: string }[] = [
  { id: "list", label: "Guest list" },
  { id: "replies", label: "Replies" },
  { id: "seating", label: "Seating" },
];

type SectionProps = ComponentProps<typeof GuestsSection>;

interface Props extends Omit<SectionProps, "part"> {
  /** Guest replies, loaded once for the whole section (see usePlanTabs). */
  replies: Replies;
  entries: Entries;
  functions: string[];
  today: string;
  onList: (next: Entries) => void;
  /** Part to open first: "replies" right after getting the guest link. */
  initialPart?: Part;
}

/** The Guests section: the host's guest list, the replies from the guest link, and seating. */
export function GuestsHub({ entries, functions, today, onList, initialPart = "list", ...section }: Props) {
  const [part, setPart] = useState<Part>(initialPart);
  const { replies, error } = section.replies;
  return (
    <>
      <h2 className="section-title">Guests</h2>
      <div className="segmented no-print" role="group" aria-label="Guests">
        {PARTS.map((p) => (
          <button key={p.id} type="button" aria-pressed={part === p.id} onClick={() => setPart(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {part === "list" ? (
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
      ) : part === "seating" ? (
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
            seating={section.seating ?? DEFAULT_SEATING}
            title={section.title}
            onChange={section.onSeating}
          />
        </>
      ) : (
        <GuestsSection {...section} part="replies" />
      )}
    </>
  );
}
