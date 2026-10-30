"use client";

import { whatsappLink, type Member } from "@/lib/team";
import type { MemberSummary } from "./teamSummary";

/** The team, one row per person with their task counts and actions. */
export function MemberList({
  summaries,
  shareUrl,
  busy,
  onRemove,
}: {
  summaries: MemberSummary[];
  shareUrl: string | null;
  busy: boolean;
  onRemove: (member: Member) => void;
}) {
  if (summaries.length === 0) return null;
  return (
    <ul className="members">
      {summaries.map(({ member: m, total, finished, message }) => (
        <li key={m.id} className="member">
          <span className="avatar" aria-hidden="true">
            {m.name.charAt(0).toUpperCase()}
          </span>
          <span className="member-info">
            <strong>{m.name}</strong>
            {m.role && <span className="muted small"> · {m.role}</span>}
            <span className="small muted member-count">
              {total} task{total === 1 ? "" : "s"}, {finished} done
            </span>
          </span>
          <span className="member-actions no-print">
            {shareUrl && (
              <a className="btn btn-small" href={whatsappLink(message)} target="_blank" rel="noopener noreferrer">
                Send tasks<span className="sr-only"> to {m.name} on WhatsApp (opens in a new tab)</span>
              </a>
            )}
            <button type="button" className="btn btn-small btn-link" onClick={() => onRemove(m)} disabled={busy}>
              Remove<span className="sr-only"> {m.name}</span>
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
