import type { GuestEntry } from "./entry";

/** The WhatsApp messages to one family: the invitation and a gentle reminder. */

function firstName(name: string): string {
  return name.replace(/\b(?:family|team|gang|group)\b/gi, "").trim() || name;
}

/** The WhatsApp invitation for one family, with the reply link when there is one. */
export function inviteFor(
  entry: GuestEntry,
  base: { title: string; inviteText: string; link: string; when: string },
): string {
  const hello = `Dear ${firstName(entry.name)},`;
  const body = base.inviteText || `You are warmly invited to ${base.title} on ${base.when}.`;
  const ask = base.link ? `Please tell us if you can come, and how many of you: ${base.link}` : "";
  return [hello, body, ask].filter(Boolean).join("\n\n");
}

export function reminderFor(entry: GuestEntry, base: { title: string; link: string; when: string }): string {
  const ask = base.link ? `Could you let us know here: ${base.link}` : "Could you let us know by message?";
  return `Dear ${firstName(entry.name)}, a gentle reminder about ${base.title} on ${base.when}. We'd love to know if you can come and how many of you. ${ask}`;
}
