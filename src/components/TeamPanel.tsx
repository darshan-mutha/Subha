"use client";

import { useId, useRef, useState } from "react";
import { MAX_MEMBERS, type Assignments, type Done, type Member, type PlanItem } from "@/lib/team";
import { AddMemberForm } from "./team/AddMemberForm";
import { MemberList } from "./team/MemberList";
import { DivideTasks, TeamProgress, TeamShare } from "./team/TeamShare";
import { memberSummaries, teamTotals } from "./team/teamSummary";

interface Props {
  team: Member[];
  items: PlanItem[];
  assignments: Assignments;
  done: Done;
  eventTitle: string;
  shareUrl: string | null;
  /** Today's date (YYYY-MM-DD), to put due dates in WhatsApp messages. */
  today?: string;
  busy: boolean;
  onTeamChange: (team: Member[]) => void;
  onAutoAssign: () => void;
  onShare: (() => void) | null;
}

/** Add helpers, let AI split the work, and send each person their tasks. */
export function TeamPanel(props: Props) {
  const { team, items, assignments, done, eventTitle, shareUrl, today, busy, onTeamChange, onAutoAssign, onShare } =
    props;
  const headingId = useId();
  const nameRef = useRef<HTMLInputElement | null>(null);
  // The add-person form stays folded until the host asks for it (or has a team), to keep the page short.
  const [adding, setAdding] = useState(false);

  const totals = teamTotals(items, assignments, done);
  const summaries = memberSummaries({ team, items, assignments, done, eventTitle, shareUrl, today });
  const roomForMore = team.length < MAX_MEMBERS;

  return (
    <section className="card team" aria-labelledby={headingId}>
      <h2 id={headingId} className="section-title">
        Plan together
      </h2>
      <p className="muted">
        Add the family and friends helping you. Shubā will share out the work, and everyone can tick off their tasks
        from one link.
      </p>

      <TeamProgress done={totals.done} total={totals.total} />

      <MemberList
        summaries={summaries}
        shareUrl={shareUrl}
        busy={busy}
        onRemove={(m) => onTeamChange(team.filter((x) => x.id !== m.id))}
      />

      {roomForMore && !adding && team.length === 0 && (
        <button
          type="button"
          className="btn no-print"
          onClick={() => {
            setAdding(true);
            requestAnimationFrame(() => nameRef.current?.focus());
          }}
        >
          <span aria-hidden="true">+ </span>Add family &amp; friends
        </button>
      )}

      {roomForMore && (adding || team.length > 0) && (
        <AddMemberForm team={team} busy={busy} nameRef={nameRef} onTeamChange={onTeamChange} />
      )}

      {team.length > 0 && (
        <DivideTasks total={totals.total} unassigned={totals.unassigned} busy={busy} onAutoAssign={onAutoAssign} />
      )}

      <TeamShare shareUrl={shareUrl} eventTitle={eventTitle} busy={busy} onShare={onShare} />
    </section>
  );
}
