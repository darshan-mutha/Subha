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
