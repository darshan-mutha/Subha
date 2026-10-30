/** Adds or removes a value from a list, never letting the list grow past `max`. */
export function toggleIn<T extends string>(list: T[], value: T, max: number): T[] {
  if (list.includes(value)) return list.filter((x) => x !== value);
  return list.length >= max ? list : [...list, value];
}
