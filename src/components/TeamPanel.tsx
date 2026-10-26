"use client";

import { useState, type FormEvent } from "react";
import {
  MAX_MEMBERS,
  MemberSchema,
  memberMessage,
  newMemberId,
  teamInviteMessage,
  whatsappLink,
  type Assignments,
  type Done,
  type Member,
  type PlanItem,
} from "@/lib/team";
import { dueText, type ScheduledItem } from "@/lib/schedule";
import { CopyButton } from "./PlanSections";

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
export function TeamPanel({
  team,
  items,
  assignments,
  done,
  eventTitle,
  shareUrl,
  today,
  busy,
  onTeamChange,
  onAutoAssign,
  onShare,
}: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  // The add-person form stays folded until the host asks for it (or has a team), to keep the page short.
  const [adding, setAdding] = useState(false);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = MemberSchema.safeParse({ id: newMemberId(), name, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the name");
      return;
    }
    if (team.some((m) => m.name.toLowerCase() === parsed.data.name.toLowerCase())) {
      setError(`${parsed.data.name} is already in the team`);
      return;
    }
    setError("");
    onTeamChange([...team, parsed.data]);
    setName("");
    setRole("");
    document.getElementById("member-name")?.focus();
  }

  const unassigned = items.filter((i) => !assignments[i.id]).length;
  const totalDone = items.filter((i) => done[i.id]).length;

  return (
    <section className="card team" aria-labelledby="team-heading">
      <h2 id="team-heading" className="section-title">
        Plan together
      </h2>
      <p className="muted">
        Add the family and friends helping you. Shubā will share out the work, and everyone can tick off their tasks
        from one link.
      </p>

      <div className="progress" aria-label="Overall progress">
        <div className="progress-bar" aria-hidden="true">
          <span style={{ width: `${items.length ? (totalDone / items.length) * 100 : 0}%` }} />
        </div>
        <p className="small">
          <strong>
            {totalDone} of {items.length}
          </strong>{" "}
          tasks done
        </p>
      </div>

      {team.length > 0 && (
        <ul className="members">
          {team.map((m) => {
            const mine = items.filter((i) => assignments[i.id] === m.id);
            const finished = mine.filter((i) => done[i.id]).length;
            const pending = mine
              .filter((i) => !done[i.id])
              .map((i) => ({ ...i, dueLabel: today && "due" in i ? dueText(i as ScheduledItem, today) : undefined }));
            const message = shareUrl ? memberMessage(m, pending, eventTitle, shareUrl) : "";
            return (
              <li key={m.id} className="member">
                <span className="avatar" aria-hidden="true">
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <span className="member-info">
                  <strong>{m.name}</strong>
                  {m.role && <span className="muted small"> · {m.role}</span>}
                  <span className="small muted member-count">
                    {mine.length} task{mine.length === 1 ? "" : "s"}, {finished} done
                  </span>
                </span>
                <span className="member-actions no-print">
                  {shareUrl && (
                    <a className="btn btn-small" href={whatsappLink(message)} target="_blank" rel="noopener noreferrer">
                      Send tasks<span className="sr-only"> to {m.name} on WhatsApp (opens in a new tab)</span>
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn btn-small btn-link"
                    onClick={() => onTeamChange(team.filter((x) => x.id !== m.id))}
                    disabled={busy}
                  >
                    Remove<span className="sr-only"> {m.name}</span>
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {team.length < MAX_MEMBERS && !adding && team.length === 0 && (
        <button
          type="button"
          className="btn no-print"
          onClick={() => {
            setAdding(true);
            requestAnimationFrame(() => document.getElementById("member-name")?.focus());
          }}
        >
          <span aria-hidden="true">+ </span>Add family &amp; friends
        </button>
      )}

      {team.length < MAX_MEMBERS && (adding || team.length > 0) && (
        <form className="add-member no-print" onSubmit={add} noValidate>
          <div className="field">
            <label htmlFor="member-name">Name</label>
            <input
              id="member-name"
              type="text"
              maxLength={40}
              placeholder="e.g. Ravi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "member-error" : undefined}
            />
          </div>
          <div className="field">
            <label htmlFor="member-role">Role or relation (optional)</label>
            <input
              id="member-role"
              type="text"
              maxLength={40}
              placeholder="e.g. cousin, knows caterers"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <button type="submit" className="btn" disabled={busy}>
            Add person
          </button>
          {error && (
            <p id="member-error" className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {team.length > 0 && (
        <div className="row no-print">
          <button type="button" className="btn btn-primary" onClick={onAutoAssign} disabled={busy}>
            {busy
              ? "Working…"
              : unassigned === items.length
                ? "Let Shubā divide the tasks"
                : "Re-divide the tasks with AI"}
          </button>
          {unassigned > 0 && unassigned < items.length && (
            <span className="small muted">{unassigned} tasks not yet assigned</span>
          )}
        </div>
      )}

      <div className="share no-print">
        {shareUrl ? (
          <>
            <h3 className="small-heading">Your team link</h3>
            <p className="muted small">
              Anyone with this link can see the plan and tick off tasks. Share it only with your team.
            </p>
            <p className="share-url">
              <code>{shareUrl}</code>
            </p>
            <div className="row">
              <CopyButton text={shareUrl} label="link" />
              <a
                className="btn btn-small"
                href={whatsappLink(teamInviteMessage(eventTitle, shareUrl))}
                target="_blank"
                rel="noopener noreferrer"
              >
                Share link on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </>
        ) : (
          onShare && (
            <button type="button" className="btn btn-lg btn-primary" onClick={onShare} disabled={busy}>
              Share this plan with my team
            </button>
          )
        )}
      </div>
    </section>
  );
}
