"use client";

import { useRef, useState } from "react";
import { ApiError, requestGuestGroups } from "@/lib/client";
import type { GuestGroupIdea } from "@/lib/guestGroups";
import { newEntryId, parseGuestText, type DraftEntry, type GuestEntry } from "@/lib/guestList";
import type { GuestGroup } from "@/lib/rsvp";
import type { EventInput } from "@/lib/schemas";

/** Which step of adding guests is showing. */
export type AddMode = "choose" | "help" | "paste" | "one";

/** The AI's suggested guest groups, with reminders and where they came from. */
export interface GroupIdeas {
  groups: GuestGroupIdea[];
  reminders: string[];
  source: string;
}

interface ContactsManager {
  select: (props: string[], options: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]>;
}

function contactsApi(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const c = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
  return c && typeof c.select === "function" ? c : null;
}

interface Options {
  input: EventInput;
  functions: string[];
  sides: GuestGroup[];
  onAdd: (entries: GuestEntry[]) => void;
}

/** State and actions for the Add guests panel: mode, AI groups, pasted text, drafts and side. */
export function useAddGuests({ input, functions, sides, onAdd }: Options) {
  const [mode, setMode] = useState<AddMode>("choose");
  const [groups, setGroups] = useState<GroupIdeas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [side, setSide] = useState<GuestGroup>("");
  const [forGroup, setForGroup] = useState("");
  const [drafts, setDrafts] = useState<DraftEntry[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const contacts = contactsApi();
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  async function help() {
    setMode("help");
    if (groups) return;
    setLoading(true);
    setError("");
    try {
      setGroups(await requestGuestGroups({ input, functions }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function startPaste(group?: GuestGroupIdea) {
    setForGroup(group?.name ?? "");
    setSide(group?.side && sides.includes(group.side) ? group.side : "");
    setText("");
    setDrafts(null);
    setSkipped([]);
    setMode("paste");
    requestAnimationFrame(() => pasteRef.current?.focus());
  }

  function read() {
    const result = parseGuestText(text);
    setDrafts(result.entries);
    setSkipped(result.skipped);
  }

  async function pickContacts() {
    if (!contacts) return;
    setError("");
    try {
      const picked = await contacts.select(["name", "tel"], { multiple: true });
      const list = picked
        .map((c) => ({
          name: (c.name?.[0] ?? "").trim().slice(0, 80),
          phone: (c.tel?.[0] ?? "").replace(/[^0-9+\s-]/g, "").slice(0, 20),
          people: 1,
          guessed: false,
        }))
        .filter((c) => c.name);
      if (!list.length) return;
      setForGroup("");
      setDrafts(list);
      setSkipped([]);
      setMode("paste");
    } catch {
      setError("Could not open your contacts. You can paste names instead.");
    }
  }

  function addDrafts() {
    if (!drafts?.length) return;
    onAdd(
      drafts.map((d) => ({
        id: newEntryId(),
        name: d.name,
        people: Math.min(50, Math.max(1, Math.round(d.people) || 1)),
        phone: d.phone,
        side,
        functions: [],
        invitedAt: "",
        remindedAt: "",
      })),
    );
  }

  return {
    mode,
    setMode,
    groups,
    loading,
    error,
    text,
    setText,
    pasteRef,
    side,
    setSide,
    forGroup,
    drafts,
    setDrafts,
    skipped,
    hasContacts: contacts !== null,
    help,
    startPaste,
    read,
    pickContacts,
    addDrafts,
  };
}
