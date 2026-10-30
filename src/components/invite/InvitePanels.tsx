"use client";

import {
  INVITE_LOOKS,
  LOOK_LABELS,
  type Invite,
  type InviteFacts,
  type InviteLook,
  type InviteWording,
} from "@/lib/invite";
import { LOOK_PALETTES } from "@/lib/inviteCard";
import { whatsappLink } from "@/lib/team";
import { CopyButton } from "../plan/CopyButton";
import type { CardImage } from "./useInviteCard";

/** The "about 10–20 seconds" note shown while Claude writes. */
export function WritingNote() {
  return (
    <p className="loading" aria-hidden="true">
      <span className="spinner" /> Writing your invite… about 10–20 seconds.
    </p>
  );
}

interface PreviewProps {
  image: CardImage | null;
  drawFailed: boolean;
  alt: string;
  look: InviteLook;
  wording: InviteWording;
  facts: InviteFacts;
  source: Invite["source"];
}

/** The drawn card, a text fallback if drawing failed, or a spinner while it draws. */
export function InvitePreview({ image, drawFailed, alt, look, wording, facts, source }: PreviewProps) {
  return (
    <figure className="invite-preview">
      {image && !drawFailed ? (
        // eslint-disable-next-line @next/next/no-img-element -- a locally drawn image, not a remote asset
        <img src={image.url} alt={alt} width={1080} height={1350} />
      ) : drawFailed ? (
        <div className={`invite-text-card look-${look}`} role="img" aria-label={alt}>
          <p className="invite-text-heading">{wording.heading}</p>
          <p>{wording.message}</p>
          <p>
            <strong>{facts.date}</strong>
            {facts.time && <> · {facts.time}</>}
            <br />
            {facts.venue}
          </p>
          {facts.note && <p className="small">{facts.note}</p>}
          <p className="invite-text-heading">{wording.closing}</p>
        </div>
      ) : (
        <div className="invite-placeholder" aria-hidden="true">
          <span className="spinner" />
        </div>
      )}
      {source === "standard" && (
        <figcaption className="small muted">
          Shubā was busy, so these are standard English words. Tap “Write again” to try in your language.
        </figcaption>
      )}
    </figure>
  );
}

interface SideProps {
  uid: string;
  look: InviteLook;
  onLook: (look: InviteLook) => void;
  image: CardImage | null;
  canShareFiles: boolean;
  message: string;
  fileName: string;
  onShare: () => void;
}

/** Card look choices and the ways to send the card. */
export function InviteSide({ uid, look, onLook, image, canShareFiles, message, fileName, onShare }: SideProps) {
  return (
    <div className="invite-side">
      <fieldset className="choice-group no-print">
        <legend>Card look</legend>
        <div className="choices">
          {INVITE_LOOKS.map((l) => (
            <label key={l} className={`choice ${look === l ? "is-on" : ""}`}>
              <input type="radio" name={`${uid}-look`} value={l} checked={look === l} onChange={() => onLook(l)} />
              <span
                className="look-swatch"
                aria-hidden="true"
                style={{ background: LOOK_PALETTES[l].bg[0], borderColor: LOOK_PALETTES[l].border }}
              />
              {LOOK_LABELS[l]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="row no-print">
        {canShareFiles && image && (
          <button type="button" className="btn btn-primary" onClick={onShare}>
            Share card
          </button>
        )}
        <a
          className={`btn ${canShareFiles ? "" : "btn-primary"}`}
          href={whatsappLink(message)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Send on WhatsApp
        </a>
        {image && (
          <a className="btn" href={image.url} download={fileName}>
            Download image
          </a>
        )}
        <CopyButton text={message} label="message" />
      </div>
      <p className="small muted no-print">
        Tip: download the card, then attach it in WhatsApp with the message. Changing the event date in your plan
        updates the card too.
      </p>
    </div>
  );
}
