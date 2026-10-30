const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * A short random id for things kept on this device or inside one plan
 * (guest entries, quotes, team members, saved events). Each kind has its own
 * prefix letter so an id says what it belongs to. Not a secret: see csp.ts
 * for nonces and the server for share tokens.
 */
export function localId(prefix: string, length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = prefix;
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}

/**
 * The pattern each kind of id must match when it comes back in, kept next to
 * localId() so the ids made and the ids accepted cannot drift apart.
 */
export const ID = {
  guest: /^g[a-z0-9]{4,16}$/,
  reply: /^r[a-z0-9]{6,16}$/,
  /** Someone seated at a table: a guest reply or a guest-list entry. */
  party: /^[rg][a-z0-9]{4,16}$/,
  quote: /^q[a-z0-9]{1,12}$/,
  member: /^m[a-z0-9]{1,12}$/,
  event: /^e[a-z0-9]{4,16}$/,
  idea: /^i_[a-z0-9]{1,12}$/,
  /** A task (t_) or vendor (v_) in a plan. */
  planItem: /^[tv]_[a-z0-9]{1,12}$/,
  vendorItem: /^v_[a-z0-9]{1,12}$/,
} as const;

/** Share links, guest links and reply secrets: 128 random bits as 22 URL-safe characters. */
export const TOKEN = /^[A-Za-z0-9_-]{22}$/;
