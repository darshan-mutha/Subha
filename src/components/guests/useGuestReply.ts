"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, ApiStatusError, loadGuestEvent, sendReply } from "@/lib/client";
import { ReplyInputSchema, type Coming, type GuestEvent, type ReplyInput } from "@/lib/rsvp";
import { fieldErrors, type GuestNeed } from "@/lib/schemas";

/** A reply this browser sent, kept so the guest can change it later. */
export interface SavedReply {
  replyId: string;
  secret: string;
  reply: ReplyInput;
}

/** The guest's reply form values, as typed. */
export interface ReplyForm {
  name: string;
  phone: string;
  coming: Coming | "";
  adults: string;
  kids: string;
  food: ReplyInput["food"];
  group: ReplyInput["group"];
  needs: GuestNeed[];
  note: string;
}

const storageKey = (token: string) => `shuba:rsvp:${token}`;

function loadSaved(token: string): SavedReply | null {
  try {
    const raw = localStorage.getItem(storageKey(token));
    const saved = raw ? (JSON.parse(raw) as SavedReply) : null;
    return saved?.replyId && saved.secret && saved.reply ? saved : null;
  } catch {
    return null;
  }
}

function keepSaved(token: string, saved: SavedReply) {
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(saved));
  } catch {
    /* the reply is sent either way; this only lets the guest change it later */
  }
}

const EMPTY: ReplyForm = {
  name: "",
  phone: "",
  coming: "",
  adults: "1",
  kids: "0",
  food: "any",
  group: "",
  needs: [],
  note: "",
};

const toForm = (r: ReplyInput): ReplyForm => ({
  ...r,
  adults: String(r.coming === "no" ? 1 : r.adults),
  kids: String(r.kids),
});

/** Loads the invitation for a reply link and holds the guest's reply form, saved reply and sending. */
export function useGuestReply(token: string) {
  const [event, setEvent] = useState<GuestEvent | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saved, setSaved] = useState<SavedReply | null>(() => loadSaved(token));
  const [editing, setEditing] = useState(() => !loadSaved(token));
  const [form, setForm] = useState<ReplyForm>(() => (saved ? toForm(saved.reply) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const thanksRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    loadGuestEvent(token).then(setEvent, (e: unknown) =>
      setLoadError(e instanceof ApiError ? e.message : "Could not load the invitation. Please try again."),
    );
  }, [token]);

  const set = <K extends keyof ReplyForm>(key: K, value: ReplyForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = ReplyInputSchema.safeParse({
      ...form,
      coming: form.coming || undefined,
      adults: form.adults === "" ? 0 : form.adults,
      kids: form.kids === "" ? 0 : form.kids,
    });
    if (!parsed.success) {
      const found = fieldErrors(parsed.error);
      setErrors(found);
      setError("Please check the highlighted answers.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setErrors({});
    setError("");
    try {
      const reply = parsed.data;
      let result: { replyId: string; secret: string };
      try {
        result = await sendReply(token, { reply, replyId: saved?.replyId, secret: saved?.secret });
      } catch (err) {
        // The reply could not be changed (e.g. removed by the hosts): send it as new.
        if (!saved || !(err instanceof ApiStatusError) || err.status !== 403) throw err;
        result = await sendReply(token, { reply });
      }
      const next = { replyId: result.replyId, secret: result.secret, reply };
      keepSaved(token, next);
      setSaved(next);
      setEditing(false);
      requestAnimationFrame(() => thanksRef.current?.focus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send your reply. Please try again.");
      if (err instanceof ApiError) setErrors(err.fields);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return {
    event,
    loadError,
    saved,
    editing,
    setEditing,
    form,
    set,
    errors,
    error,
    busy,
    thanksRef,
    errorRef,
    submit,
  };
}
