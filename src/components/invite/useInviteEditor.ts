"use client";

import { useReducer, useRef, useState, type FormEvent } from "react";
import { ApiError, requestInvite } from "@/lib/client";
import {
  EMPTY_DETAILS,
  InviteDetailsSchema,
  InviteWordingSchema,
  type Invite,
  type InviteDetails,
  type InviteLook,
  type InviteWording,
} from "@/lib/invite";
import { fieldErrors, type EventInput } from "@/lib/schemas";

/** Field name to error message. */
export type Errors = Record<string, string>;

/** What the host is editing: the invite itself plus whether it has unsaved changes. */
interface Draft {
  details: InviteDetails;
  wording: InviteWording | null;
  look: InviteLook;
  source: Invite["source"];
  dirty: boolean;
}

type Action =
  | { type: "detail"; details: Partial<InviteDetails> }
  | { type: "word"; key: keyof InviteWording; value: string }
  | { type: "look"; look: InviteLook }
  | { type: "written"; details: InviteDetails; wording: InviteWording; source: Invite["source"] }
  | { type: "saved" }
  | { type: "sync"; invite: Invite };

function reducer(state: Draft, action: Action): Draft {
  switch (action.type) {
    case "detail":
      return { ...state, details: { ...state.details, ...action.details }, dirty: true };
    case "word":
      return state.wording
        ? { ...state, wording: { ...state.wording, [action.key]: action.value }, dirty: true }
        : state;
    case "look":
      return { ...state, look: action.look };
    case "written":
      return { ...state, details: action.details, wording: action.wording, source: action.source };
    case "saved":
      return { ...state, dirty: false };
    case "sync":
      if (state.dirty) return state;
      return {
        ...state,
        details: action.invite.details,
        wording: action.invite.wording,
        look: action.invite.look,
        source: action.invite.source,
      };
  }
}

function initialDraft(invite: Invite | null): Draft {
  return {
    details: invite?.details ?? EMPTY_DETAILS,
    wording: invite?.wording ?? null,
    look: invite?.look ?? "peacock",
    source: invite?.source ?? "ai",
    dirty: false,
  };
}

/** Holds the invite being edited, and writes (via Claude) and saves it. */
export function useInviteEditor(
  input: EventInput,
  invite: Invite | null,
  onSave: (invite: Invite | null) => Promise<void>,
) {
  const [draft, dispatch] = useReducer(reducer, invite, initialDraft);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const wordingRef = useRef<HTMLHeadingElement>(null);
  const { details, wording, look, source } = draft;

  // Take in changes saved elsewhere (another helper on a shared plan) unless the host is mid-edit.
  const [seen, setSeen] = useState(invite);
  if (invite !== seen) {
    setSeen(invite);
    if (invite) dispatch({ type: "sync", invite });
  }

  function setDetail<K extends keyof InviteDetails>(key: K, value: InviteDetails[K]) {
    dispatch({ type: "detail", details: { [key]: value } });
  }

  function setWord(key: keyof InviteWording, value: string) {
    dispatch({ type: "word", key, value });
  }

  async function save(next: Invite | null, done: string) {
    try {
      await onSave(next);
      dispatch({ type: "saved" });
      setStatus(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the invite. Please check your connection.");
    }
  }

  async function write(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    const parsed = InviteDetailsSchema.safeParse(details);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    setStatus("Writing your invite…");
    try {
      const reply = await requestInvite(input, parsed.data);
      dispatch({ type: "written", details: parsed.data, wording: reply.wording, source: reply.source });
      await save(
        { details: parsed.data, wording: reply.wording, look, source: reply.source },
        "Your invite is ready. You can change any words below.",
      );
      requestAnimationFrame(() => wordingRef.current?.focus());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  /** Saves edits to the words or card details, after checking them. */
  function commit(nextLook: InviteLook = look) {
    if (!wording) return;
    const checked = InviteWordingSchema.safeParse(wording);
    const checkedDetails = InviteDetailsSchema.safeParse(details);
    const errs = {
      ...(checked.success ? {} : fieldErrors(checked.error)),
      ...(checkedDetails.success ? {} : fieldErrors(checkedDetails.error)),
    };
    setErrors(errs);
    if (!checked.success || !checkedDetails.success) return;
    void save({ details: checkedDetails.data, wording: checked.data, look: nextLook, source }, "Saved");
  }

  /** Picks a card look and saves it straight away. */
  function chooseLook(next: InviteLook) {
    dispatch({ type: "look", look: next });
    commit(next);
  }

  return {
    details,
    wording,
    look,
    source,
    errors,
    error,
    busy,
    status,
    wordingRef,
    setDetail,
    setWord,
    write,
    commit,
    chooseLook,
  };
}
