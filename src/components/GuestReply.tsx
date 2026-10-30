"use client";

import { useId } from "react";
import type { ReplyInput } from "@/lib/rsvp";
import { InviteCard, ReplyFormCard, ReplyThanks } from "./guests/GuestReplyParts";
import { useGuestReply } from "./guests/useGuestReply";

/** One sentence that sums up a guest's reply, e.g. "Coming: 2 adults and 1 child." */
export function replySentence(reply: ReplyInput): string {
  if (reply.coming === "no") return "You can't come. The hosts will miss you.";
  const parts = [`${reply.adults} adult${reply.adults === 1 ? "" : "s"}`];
  if (reply.kids) parts.push(`${reply.kids} child${reply.kids === 1 ? "" : "ren"}`);
  return `${reply.coming === "yes" ? "Coming" : "Maybe coming"}: ${parts.join(" and ")}.`;
}

/** The page a guest opens from the reply link. Shows the invitation and takes their reply. */
export function GuestReply({ token }: { token: string }) {
  const id = useId();
  const r = useGuestReply(token);
  const { event, saved } = r;

  if (r.loadError) {
    return (
      <div className="card guest-page">
        <h1 className="section-title">Invitation not found</h1>
        <p role="alert">{r.loadError}</p>
      </div>
    );
  }
  if (!event) {
    return (
      <p className="loading" role="status">
        <span className="spinner" aria-hidden="true" /> Loading the invitation…
      </p>
    );
  }

  return (
    <div className="guest-page">
      <InviteCard event={event} />

      {saved && !r.editing ? (
        <ReplyThanks
          id={id}
          name={saved.reply.name}
          sentence={replySentence(saved.reply)}
          open={event.open}
          headingRef={r.thanksRef}
          onChange={() => r.setEditing(true)}
        />
      ) : !event.open ? (
        <section className="card">
          <h2 className="section-title">Replies are closed</h2>
          <p>The hosts are no longer taking replies online. Please contact them directly.</p>
        </section>
      ) : (
        <ReplyFormCard
          id={id}
          event={event}
          form={r.form}
          set={r.set}
          errors={r.errors}
          error={r.error}
          errorRef={r.errorRef}
          busy={r.busy}
          changing={saved !== null}
          onSubmit={(e) => void r.submit(e)}
          onCancel={() => r.setEditing(false)}
        />
      )}
      <p className="small muted guest-footer">Made with Shubā — plan any celebration in minutes.</p>
    </div>
  );
}
