"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ApiError, guestAction, loadGuests, type GuestsState } from "@/lib/client";
import { inviteFacts, inviteMessage, type Invite } from "@/lib/invite";
import {
  COMING_LABELS,
  GUEST_FOOD_LABELS,
  GUEST_GROUP_LABELS,
  needLine,
  repliesCsv,
  rsvpMessage,
  suggestedGuests,
  summarize,
  type Reply,
} from "@/lib/rsvp";
import { GUEST_NEED_LABELS, type EventInput } from "@/lib/schemas";
import { whatsappLink } from "@/lib/team";
import { CopyButton } from "./PlanSections";
import { SeatingSection } from "./SeatingSection";
import { DEFAULT_SEATING, type Seating } from "@/lib/seating";

const POLL_MS = 30_000;

interface Props {
  /** The shared plan's id, or null while the plan is only on this device. */
  planId: string | null;
  /** Replies load and refresh only while the Guests tab is open. */
  active: boolean;
  input: EventInput;
  title: string;
  invite: Invite | null;
  busy: boolean;
  /** Saves the plan online (team link), then comes back to this tab. */
  onShare: (() => void) | null;
  /** Re-plans for a new guest count, with What changed and Undo. */
  onUseGuests: (guests: number) => void;
  seating?: Seating;
  onSeating: (next: Seating) => void;
}

function people(r: Reply): string {
  if (r.coming === "no") return "–";
  return r.kids ? `${r.adults} + ${r.kids} ${r.kids === 1 ? "child" : "children"}` : `${r.adults}`;
}

/** Guests tab: the reply link, live counts, food and needs, and every reply. */
export function GuestsSection({
  planId,
  active,
  input,
  title,
  invite,
  busy,
  onShare,
  onUseGuests,
  seating = DEFAULT_SEATING,
  onSeating,
}: Props) {
  const id = useId();
  const [state, setState] = useState<GuestsState | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState("");

  const refresh = useCallback((): Promise<void> => {
    if (!planId) return Promise.resolve();
    return loadGuests(planId).then(
      (next) => {
        setState(next);
        setError("");
      },
      (e: unknown) => setError(e instanceof ApiError ? e.message : "Could not load guest replies."),
    );
  }, [planId]);

  useEffect(() => {
    if (!planId || !active) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [planId, active, refresh]);

  const replies = useMemo(() => state?.replies ?? [], [state]);
  const summary = useMemo(() => summarize(replies), [replies]);
  const suggestion = suggestedGuests(summary, input.guests);

  async function run(action: Parameters<typeof guestAction>[1]) {
    if (!planId) return;
    setWorking(true);
    setError("");
    try {
      setState(await guestAction(planId, action));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  const heading = (
    <>
      <h2 className="section-title">Guest replies</h2>
      <p className="muted">
        Send guests one link. Each family says if they&rsquo;re coming, how many, their food and any needs. Shubā counts
        it all for you, and guests never see your plan or budget.
      </p>
    </>
  );

  if (!planId) {
    return (
      <>
        {heading}
        <p>To get the guest link, Shubā saves this plan online, the same as sharing it with your team.</p>
        {onShare && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onShare}>
            Get my guest link
          </button>
        )}
      </>
    );
  }

  if (!state) {
    return (
      <>
        {heading}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="loading" role="status">
            <span className="spinner" aria-hidden="true" /> Loading replies…
          </p>
        )}
      </>
    );
  }

  const link = state.link ? `${window.location.origin}/r/${state.link.token}` : "";
  const inviteText = invite ? inviteMessage(invite.wording, inviteFacts(input, invite.details)) : "";
  const csv = replies.length ? `data:text/csv;charset=utf-8,${encodeURIComponent(repliesCsv(replies))}` : "";

  return (
    <>
      {heading}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!state.link ? (
        <button
          type="button"
          className="btn btn-primary"
          disabled={working}
          onClick={() => void run({ action: "open" })}
        >
          Turn on guest replies
        </button>
      ) : (
        <div className="guest-link card-inner">
          <p className="small-heading">
            Guest link{" "}
            <span className={`chip-label${state.link.open ? "" : " is-past"}`}>
              {state.link.open ? "Taking replies" : "Replies closed"}
            </span>
          </p>
          <p className="link-text small">{link}</p>
          <div className="row">
            <a
              className="btn btn-primary btn-small"
              href={whatsappLink(rsvpMessage(title, link, inviteText))}
              target="_blank"
              rel="noopener noreferrer"
            >
              Send on WhatsApp<span className="sr-only"> (opens WhatsApp)</span>
            </a>
            <CopyButton text={link} label="guest link" />
            <a className="btn btn-small btn-link" href={link} target="_blank" rel="noopener noreferrer">
              See what guests see<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <button
            type="button"
            className="btn btn-small btn-link"
            disabled={working}
            onClick={() => void run({ action: state.link?.open ? "close" : "open" })}
          >
            {state.link.open ? "Stop taking replies" : "Take replies again"}
          </button>
          {!invite && (
            <p className="hint">
              Tip: make the invitation card on the Invite tab first, and its words go with the link.
            </p>
          )}
        </div>
      )}

      {state.link && (
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
            Your plan is for {input.guests.toLocaleString("en-IN")} guests.
            {summary.expected > 0 && ` Replies so far point to about ${summary.expected} (coming and maybe).`}
          </p>
          {suggestion && (
            <div className="row">
              <button type="button" className="btn" disabled={busy} onClick={() => onUseGuests(suggestion)}>
                Update the plan to {suggestion} guests
              </button>
            </div>
          )}
          <button type="button" className="btn btn-small btn-link" onClick={() => void refresh()}>
            Refresh replies
          </button>
        </>
      )}

      {summary.food.length > 0 && (
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
                {summary.food.map((f) => (
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
      )}

      {summary.needs.length > 0 && (
        <>
          <h3>Guest needs</h3>
          <ul className="list">
            {summary.needs.map((n) => (
              <li key={n.need}>{needLine(n.need, n.families)}</li>
            ))}
          </ul>
        </>
      )}

      {summary.coming.families + summary.maybe.families > 0 && (
        <SeatingSection replies={replies} seating={seating} title={title} onChange={onSeating} />
      )}

      {replies.length > 0 && (
        <>
          <div className="row replies-head">
            <h3 id={`${id}-replies`}>All replies</h3>
            <a className="btn btn-small" href={csv} download="guest-replies.csv">
              Download list
            </a>
          </div>
          <ul className="reply-list" role="list" aria-labelledby={`${id}-replies`}>
            {replies.map((r) => (
              <li key={r.id} className="reply-row">
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
                {confirming === r.id ? (
                  <div className="row" role="group" aria-label={`Remove the reply from ${r.name}?`}>
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      disabled={working}
                      onClick={() => {
                        setConfirming("");
                        void run({ action: "remove", replyId: r.id });
                      }}
                    >
                      Yes, remove
                    </button>
                    <button type="button" className="btn btn-small btn-link" onClick={() => setConfirming("")}>
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-small btn-link"
                    onClick={() => setConfirming(r.id)}
                    aria-label={`Remove the reply from ${r.name}`}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
