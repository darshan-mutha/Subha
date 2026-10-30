"use client";

import { useId, useMemo } from "react";
import { inviteAltText, inviteFacts, inviteMessage, type Invite } from "@/lib/invite";
import type { EventInput } from "@/lib/schemas";
import { inviteFileName } from "./invite/fileName";
import { FactFields, VoiceFields, WordField } from "./invite/InviteFields";
import { InvitePreview, InviteSide, WritingNote } from "./invite/InvitePanels";
import { useInviteCard } from "./invite/useInviteCard";
import { useInviteEditor } from "./invite/useInviteEditor";

interface Props {
  input: EventInput;
  invite: Invite | null;
  /** Saves the invite with the plan. May reject (e.g. offline). */
  onSave: (invite: Invite | null) => Promise<void>;
}

/**
 * Invite tab: the host gives a few details, Claude writes the words in their
 * language, and Shubā draws a card they can download or send on WhatsApp.
 */
export function InviteMaker({ input, invite, onSave }: Props) {
  const uid = useId();
  const editor = useInviteEditor(input, invite, onSave);
  const { details, wording, look, source, errors, error, busy, status, wordingRef } = editor;
  const facts = useMemo(() => inviteFacts(input, details), [input, details]);
  const message = wording ? inviteMessage(wording, facts) : "";
  const { image, drawFailed, canShareFiles } = useInviteCard(wording, facts, look);
  const fieldProps = { uid, details, errors, setDetail: editor.setDetail };

  async function shareCard() {
    if (!image) return;
    try {
      await navigator.share({
        files: [new File([image.blob], inviteFileName(input), { type: "image/png" })],
        text: message,
      });
    } catch {
      /* the host closed the share sheet */
    }
  }

  const errorNote = error && (
    <p className="form-error" role="alert">
      {error}
    </p>
  );

  if (!wording) {
    return (
      <div className="invite">
        <h3 className="section-title">Make your invitation</h3>
        <p className="muted">
          Tell Shubā a few details. It writes the invitation in your language and makes a card you can send on WhatsApp.
          The date, time and venue are printed exactly as you give them.
        </p>
        <form onSubmit={editor.write} noValidate aria-busy={busy}>
          <VoiceFields {...fieldProps} />
          <FactFields {...fieldProps} city={input.city} />
          {errorNote}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Writing…" : "Write my invite"}
          </button>
          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
          {busy && <WritingNote />}
        </form>
      </div>
    );
  }

  const wordProps = { uid, wording, errors, onWord: editor.setWord, onBlur: () => editor.commit() };

  return (
    <div className="invite">
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      <div className="invite-layout">
        <InvitePreview
          image={image}
          drawFailed={drawFailed}
          alt={inviteAltText(wording, facts)}
          look={look}
          wording={wording}
          facts={facts}
          source={source}
        />
        <InviteSide
          uid={uid}
          look={look}
          onLook={editor.chooseLook}
          image={image}
          canShareFiles={canShareFiles}
          message={message}
          fileName={inviteFileName(input)}
          onShare={() => void shareCard()}
        />
      </div>

      <section className="invite-edit no-print" aria-labelledby={`${uid}-words`}>
        <h3 id={`${uid}-words`} className="section-title" ref={wordingRef} tabIndex={-1}>
          Change the words
        </h3>
        <WordField {...wordProps} name="heading" label="Heading" max={80} />
        <WordField {...wordProps} name="message" label="Invitation" max={420} long />
        <WordField {...wordProps} name="closing" label="Closing line" max={120} />
        <FactFields {...fieldProps} city={input.city} onBlur={() => editor.commit()} />
      </section>

      <details className="invite-rewrite no-print">
        <summary>Change language or tone</summary>
        <VoiceFields {...fieldProps} />
        {errorNote}
        <button type="button" className="btn" disabled={busy} onClick={() => void editor.write()}>
          {busy ? "Writing…" : "Write again"}
        </button>
        {busy && <WritingNote />}
      </details>
    </div>
  );
}
