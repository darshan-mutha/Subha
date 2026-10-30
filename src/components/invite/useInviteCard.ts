"use client";

import { useEffect, useState } from "react";
import type { InviteFacts, InviteLook, InviteWording } from "@/lib/invite";
import { renderInviteCard } from "@/lib/inviteCard";

/** A drawn invite card, ready to show, download or share. */
export interface CardImage {
  url: string;
  blob: Blob;
}

/** Draws the card whenever its words, facts or look change. */
export function useInviteCard(wording: InviteWording | null, facts: InviteFacts, look: InviteLook) {
  const [image, setImage] = useState<CardImage | null>(null);
  const [drawFailed, setDrawFailed] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    if (!wording) return;
    let cancelled = false;
    let url = "";
    const timer = setTimeout(async () => {
      const blob = await renderInviteCard(wording, facts, look);
      if (cancelled) return;
      if (!blob) {
        setDrawFailed(true);
        return;
      }
      url = URL.createObjectURL(blob);
      setDrawFailed(false);
      setImage({ url, blob });
      try {
        setCanShareFiles(
          Boolean(navigator.canShare?.({ files: [new File([blob], "invite.png", { type: "image/png" })] })),
        );
      } catch {
        setCanShareFiles(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }, [wording, facts, look]);

  return { image, drawFailed, canShareFiles };
}
