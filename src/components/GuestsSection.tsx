"use client";

import { useId, useMemo, useState } from "react";
import { guestAction, ApiError } from "@/lib/client";
import { inviteFacts, inviteMessage, type Invite } from "@/lib/invite";
import { repliesCsv, rsvpMessage, suggestedGuests, summarize } from "@/lib/rsvp";
import type { EventInput } from "@/lib/schemas";
import type { Seating } from "@/lib/seating";
import { AllReplies, ComingCounts, FoodCount, GuestLinkCard, GuestNeeds } from "./guests/GuestsSectionParts";
import { useReplies } from "./useReplies";

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
  /** Kept for the Guests hub, which shows the seating plan itself. */
  part?: "replies";
}

/** The line at the top of the Replies part. */
function RepliesIntro() {
  return (
    <p className="muted">
      Send guests one link. Each family says if they&rsquo;re coming, how many, their food and any needs. Shubā counts
      it all for you, and guests never see your plan or budget.
    </p>
  );
}

/** Before the plan is online: how to get a guest link. */
function NeedsSharing({ busy, onShare }: Pick<Props, "busy" | "onShare">) {
  return (
    <>
      <RepliesIntro />
      <p>To get the guest link, Shubā saves this plan online, the same as sharing it with your team.</p>
      {onShare && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onShare}>
          Get my guest link
        </button>
      )}
    </>
  );
}

/** Until the first load: an error, or a loading line. */
function RepliesLoading({ error }: { error: string }) {
  return (
    <>
      <RepliesIntro />
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

/** Replies and the guest link, plus `run` for the link actions (turn on/off, remove a reply). */
function useGuestLink(planId: string | null, active: boolean) {
  const replies = useReplies(planId, active);
  const { setState, setError } = replies;
  const [working, setWorking] = useState(false);

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

  return { ...replies, working, run };
}

/** Guests tab: the reply link, live counts, food and needs, and every reply. */
export function GuestsSection({ planId, active, input, title, invite, busy, onShare, onUseGuests }: Props) {
  const id = useId();
  const { state, replies, error, refresh, working, run } = useGuestLink(planId, active);
  const summary = useMemo(() => summarize(replies), [replies]);

  if (!planId) return <NeedsSharing busy={busy} onShare={onShare} />;
  if (!state) return <RepliesLoading error={error} />;

  const link = state.link ? `${window.location.origin}/r/${state.link.token}` : "";
  const inviteText = invite ? inviteMessage(invite.wording, inviteFacts(input, invite.details)) : "";
  const csv = replies.length ? `data:text/csv;charset=utf-8,${encodeURIComponent(repliesCsv(replies))}` : "";

  return (
    <>
      <RepliesIntro />
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
        <GuestLinkCard
          link={state.link}
          url={link}
          whatsappText={rsvpMessage(title, link, inviteText)}
          working={working}
          hasInvite={Boolean(invite)}
          onToggle={() => void run({ action: state.link?.open ? "close" : "open" })}
        />
      )}

      {state.link && (
        <ComingCounts
          summary={summary}
          guests={input.guests}
          suggestion={suggestedGuests(summary, input.guests)}
          busy={busy}
          onUseGuests={onUseGuests}
          onRefresh={() => void refresh()}
        />
      )}

      {summary.food.length > 0 && <FoodCount food={summary.food} />}

      {summary.needs.length > 0 && <GuestNeeds needs={summary.needs} />}

      {replies.length > 0 && (
        <AllReplies
          id={id}
          replies={replies}
          csv={csv}
          working={working}
          onRemove={(replyId) => void run({ action: "remove", replyId })}
        />
      )}
    </>
  );
}
