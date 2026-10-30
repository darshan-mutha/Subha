"use client";

import { teamInviteMessage, whatsappLink } from "@/lib/team";
import { CopyButton } from "../plan/CopyButton";

/** The team link with copy and WhatsApp buttons, or a button to create it. */
export function TeamShare({
  shareUrl,
  eventTitle,
  busy,
  onShare,
}: {
  shareUrl: string | null;
  eventTitle: string;
  busy: boolean;
  onShare: (() => void) | null;
}) {
  return (
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
  );
}

/** The divide-the-tasks button with a count of tasks nobody has yet. */
export function DivideTasks({
  total,
  unassigned,
  busy,
  onAutoAssign,
}: {
  total: number;
  unassigned: number;
  busy: boolean;
  onAutoAssign: () => void;
}) {
  const label = busy ? "Working…" : unassigned === total ? "Let Shubā divide the tasks" : "Re-divide the tasks with AI";
  return (
    <div className="row no-print">
      <button type="button" className="btn btn-primary" onClick={onAutoAssign} disabled={busy}>
        {label}
      </button>
      {unassigned > 0 && unassigned < total && <span className="small muted">{unassigned} tasks not yet assigned</span>}
    </div>
  );
}

/** Overall "n of m tasks done" with a bar; the bar is decorative, the text carries the numbers. */
export function TeamProgress({ done, total }: { done: number; total: number }) {
  return (
    <div className="progress" role="group" aria-label="Overall progress">
      <div className="progress-bar" aria-hidden="true">
        <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <p className="small">
        <strong>
          {done} of {total}
        </strong>{" "}
        tasks done
      </p>
    </div>
  );
}
