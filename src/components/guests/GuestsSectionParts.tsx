"use client";

import { useState } from "react";
import type { GuestsState } from "@/lib/client";
import {
  COMING_LABELS,
  GUEST_FOOD_LABELS,
  GUEST_GROUP_LABELS,
  needLine,
  type Reply,
  type ReplySummary,
} from "@/lib/rsvp";
import { GUEST_NEED_LABELS } from "@/lib/schemas";
import { whatsappLink } from "@/lib/team";
import { CopyButton } from "../plan/CopyButton";

type Summary = ReplySummary;
type GuestLink = NonNullable<GuestsState["link"]>;

function people(r: Reply): string {
  if (r.coming === "no") return "–";
  return r.kids ? `${r.adults} + ${r.kids} ${r.kids === 1 ? "child" : "children"}` : `${r.adults}`;
}

/** The guest reply link with WhatsApp, copy, preview and open/close controls. */
export function GuestLinkCard({
  link,
  url,
  whatsappText,
  working,
  hasInvite,
  onToggle,
}: {
  link: GuestLink;
  url: string;
  whatsappText: string;
  working: boolean;
  hasInvite: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="guest-link card-inner">
      <p className="small-heading">
        Guest link{" "}
        <span className={`chip-label${link.open ? "" : " is-past"}`}>
          {link.open ? "Taking replies" : "Replies closed"}
        </span>
      </p>
      <p className="link-text small">{url}</p>
      <div className="row">
        <a
          className="btn btn-primary btn-small"
          href={whatsappLink(whatsappText)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Send on WhatsApp<span className="sr-only"> (opens WhatsApp)</span>
        </a>
        <CopyButton text={url} label="guest link" />
        <a className="btn btn-small btn-link" href={url} target="_blank" rel="noopener noreferrer">
          See what guests see<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <button type="button" className="btn btn-small btn-link" disabled={working} onClick={onToggle}>
        {link.open ? "Stop taking replies" : "Take replies again"}
      </button>
      {!hasInvite && (
        <p className="hint">Tip: make the invitation card on the Invite tab first, and its words go with the link.</p>
      )}
    </div>
  );
}

/** Who's coming: live counts, the plan's guest number and an offer to update it. */
export function ComingCounts({
  summary,
  guests,
  suggestion,
  busy,
  onUseGuests,
  onRefresh,
}: {
  summary: Summary;
  guests: number;
  suggestion: number | null;
  busy: boolean;
  onUseGuests: (guests: number) => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <h3>Who&rsquo;s coming</h3>
      <dl className="payments guest-counts">
        <div>
          <dt>Coming</dt>
          <dd>
            {summary.coming.people} {summary.coming.people === 1 ? "person" : "people"}
          </dd>
          <dd className="small muted payments-sub">
            {summary.coming.adults} {summary.coming.adults === 1 ? "adult" : "adults"}, {summary.coming.kids}{" "}
            {summary.coming.kids === 1 ? "child" : "children"} · {summary.coming.families}{" "}
            {summary.coming.families === 1 ? "family" : "families"}
          </dd>
        </div>
        <div>
          <dt>Maybe</dt>
          <dd>{summary.maybe.people}</dd>
        </div>
        <div>
          <dt>Can&rsquo;t come</dt>
          <dd>{summary.notComing}</dd>
        </div>
        <div>
          <dt>Replies</dt>
          <dd>{summary.replies}</dd>
        </div>
      </dl>
      <p className="small muted" role="status">
        Your plan is for {guests.toLocaleString("en-IN")} guests.
        {summary.expected > 0 && ` Replies so far point to about ${summary.expected} (coming and maybe).`}
      </p>
      {suggestion && (
        <div className="row">
          <button type="button" className="btn" disabled={busy} onClick={() => onUseGuests(suggestion)}>
            Update the plan to {suggestion} guests
          </button>
        </div>
      )}
      <button type="button" className="btn btn-small btn-link" onClick={onRefresh}>
        Refresh replies
      </button>
    </>
  );
}

/** The food count table: people by food choice, coming and maybe. */
export function FoodCount({ food }: { food: Summary["food"] }) {
  return (
    <>
      <h3>Food count</h3>
      <div className="table-wrap">
        <table className="budget-table">
          <caption className="sr-only">People by food choice</caption>
          <thead>
            <tr>
              <th scope="col">Food</th>
              <th scope="col" className="num">
                Coming
              </th>
              <th scope="col" className="num">
                Maybe
              </th>
            </tr>
          </thead>
          <tbody>
            {food.map((f) => (
              <tr key={f.food}>
                <th scope="row">{GUEST_FOOD_LABELS[f.food]}</th>
                <td className="num">{f.people}</td>
                <td className="num">{f.maybe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Guest needs, one line per need with how many families. */
export function GuestNeeds({ needs }: { needs: Summary["needs"] }) {
  return (
    <>
      <h3>Guest needs</h3>
      <ul className="list">
        {needs.map((n) => (
          <li key={n.need}>{needLine(n.need, n.families)}</li>
        ))}
      </ul>
    </>
  );
}

/** One reply in the list, with a two-step Remove. */
function ReplyRow({
  reply: r,
  confirming,
  working,
  onAskRemove,
  onKeep,
  onRemove,
}: {
  reply: Reply;
  confirming: boolean;
  working: boolean;
  onAskRemove: () => void;
  onKeep: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="reply-row">
      <div>
        <p className="reply-name">
          {r.name} <span className={`chip-label reply-${r.coming}`}>{COMING_LABELS[r.coming]}</span>
        </p>
        <p className="small muted">
          {[
            r.coming !== "no" && `People: ${people(r)}`,
            r.coming !== "no" && r.food !== "any" && GUEST_FOOD_LABELS[r.food],
            r.group && GUEST_GROUP_LABELS[r.group],
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {r.needs.length > 0 && <p className="small">{r.needs.map((n) => GUEST_NEED_LABELS[n]).join(", ")}</p>}
        {r.note && <p className="small">“{r.note}”</p>}
        {r.phone && (
          <p className="small">
            <a href={`tel:${r.phone.replace(/\s/g, "")}`}>{r.phone}</a>
          </p>
        )}
      </div>
      {confirming ? (
        <div className="row" role="group" aria-label={`Remove the reply from ${r.name}?`}>
          <button type="button" className="btn btn-small btn-danger" disabled={working} onClick={onRemove}>
            Yes, remove
          </button>
          <button type="button" className="btn btn-small btn-link" onClick={onKeep}>
            Keep it
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-small btn-link"
          onClick={onAskRemove}
          aria-label={`Remove the reply from ${r.name}`}
        >
          Remove
        </button>
      )}
    </li>
  );
}

/** Every reply, with a CSV download and Remove on each. */
export function AllReplies({
  id,
  replies,
  csv,
  working,
  onRemove,
}: {
  id: string;
  replies: Reply[];
  csv: string;
  working: boolean;
  onRemove: (replyId: string) => void;
}) {
  const [confirming, setConfirming] = useState("");
  return (
    <>
      <div className="row replies-head">
        <h3 id={`${id}-replies`}>All replies</h3>
        <a className="btn btn-small" href={csv} download="guest-replies.csv">
          Download list
        </a>
      </div>
      <ul className="reply-list" role="list" aria-labelledby={`${id}-replies`}>
        {replies.map((r) => (
          <ReplyRow
            key={r.id}
            reply={r}
            confirming={confirming === r.id}
            working={working}
            onAskRemove={() => setConfirming(r.id)}
            onKeep={() => setConfirming("")}
            onRemove={() => {
              setConfirming("");
              onRemove(r.id);
            }}
          />
        ))}
      </ul>
    </>
  );
}
