import { addDays } from "./dates";

/**
 * Traditions, functions and modern additions.
 *
 * The list of usual functions per tradition lives in code, not in the AI, so
 * the host sees suggestions instantly and both halves of a new plan (written at
 * the same time) agree on the same functions. Every family does things a little
 * differently, so these are only starting points: the host ticks, removes,
 * renames and adds their own, and the plan always says to check with elders.
 */

export const TRADITIONS = [
  "north-hindu",
  "punjabi",
  "sikh",
  "marwari",
  "gujarati",
  "bengali",
  "maharashtrian",
  "tamil",
  "telugu",
  "kannada",
  "malayali",
  "muslim",
  "christian",
  "jain",
  "other",
] as const;

export type Tradition = (typeof TRADITIONS)[number];

export const TRADITION_LABELS: Record<Tradition, string> = {
  "north-hindu": "North Indian Hindu",
  punjabi: "Punjabi Hindu",
  sikh: "Sikh",
  marwari: "Marwari / Rajasthani",
  gujarati: "Gujarati",
  bengali: "Bengali",
  maharashtrian: "Maharashtrian",
  tamil: "Tamil",
  telugu: "Telugu",
  kannada: "Kannada",
  malayali: "Malayali",
  muslim: "Muslim",
  christian: "Christian",
  jain: "Jain",
  other: "Other",
};

/** Event types that can run over several days with separate functions. */
export const MULTI_DAY_EVENT_TYPES: ReadonlySet<string> = new Set(["wedding"]);

export const MAX_DAYS = 7;
export const MAX_FUNCTIONS = 12;

/** Usual wedding functions, in the order they normally happen. */
const WEDDING_FUNCTIONS: Record<Tradition, string[]> = {
  "north-hindu": ["Roka", "Haldi", "Mehendi", "Sangeet", "Wedding (pheras)", "Reception"],
  punjabi: ["Roka", "Chunni", "Mehendi", "Sangeet", "Chooda & haldi", "Wedding (pheras)", "Reception"],
  sikh: ["Kurmai", "Mehendi", "Sangeet", "Maiyan", "Anand Karaj", "Reception"],
  marwari: ["Tilak", "Mehendi", "Mayra", "Haldi (pithi)", "Sangeet", "Wedding (pheras)", "Reception"],
  gujarati: ["Gol dhana", "Mandap muhurat", "Mehendi", "Garba & sangeet", "Pithi", "Wedding (pheras)", "Reception"],
  bengali: ["Aashirbaad", "Gaye holud", "Wedding (saat paak & sindoor daan)", "Bou bhaat"],
  maharashtrian: ["Sakhar puda", "Kelvan", "Haldi", "Wedding (antarpat & saptapadi)", "Reception"],
  tamil: ["Nichayathartham", "Pandhakaal", "Nalangu", "Muhurtham", "Reception"],
  telugu: ["Nischitartham", "Pellikuthuru & pellikoduku", "Haldi", "Muhurtham (jeelakarra bellam)", "Reception"],
  kannada: ["Nischitartha", "Devara samaradhane", "Arishina shastra (haldi)", "Muhurtha (dhare)", "Reception"],
  malayali: ["Engagement", "Haldi", "Wedding (thali kettu)", "Reception"],
  muslim: ["Mangni", "Manjha (haldi)", "Mehendi", "Nikah", "Walima"],
  christian: ["Engagement", "Bridal shower", "Church wedding", "Reception"],
  jain: ["Sagai", "Mehendi", "Sangeet", "Wedding (phera)", "Reception"],
  other: ["Engagement", "Haldi", "Mehendi", "Sangeet", "Wedding", "Reception"],
};

/** Modern additions many families now include. */
export const MODERN_ADDITIONS = [
  "bachelor",
  "shoot",
  "cocktail",
  "choreography",
  "welcome",
  "afterparty",
  "brunch",
] as const;

export type ModernAddition = (typeof MODERN_ADDITIONS)[number];

export const ADDITION_LABELS: Record<ModernAddition, string> = {
  bachelor: "Bachelor / bachelorette party",
  shoot: "Pre-wedding shoot",
  cocktail: "Cocktail night",
  choreography: "Sangeet choreography",
  welcome: "Welcome dinner for outstation guests",
  afterparty: "After-party",
  brunch: "Day-after brunch",
};

/** Words that mark the main ceremony, which usually sits near the end of the days. */
const MAIN_CEREMONY =
  /wedding|pheras|anand karaj|muhurt|nikah|church|thali|dhare|saptapadi|sindoor|phera\b|reception|walima|bou bhaat/i;

const RECEPTION = /reception|walima|bou bhaat/i;

/**
 * Suggested functions for the chosen traditions, without duplicates. With two
 * traditions (two families), functions both share appear once, in a sensible order.
 */
export function usualFunctions(traditions: readonly Tradition[], eventType: string): string[] {
  if (!MULTI_DAY_EVENT_TYPES.has(eventType)) return [];
  const chosen = traditions.length > 0 ? traditions : (["other"] as Tradition[]);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (name: string) => {
    const key = name.toLowerCase().replace(/\s*\(.*\)\s*/, "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  // Pre-wedding functions from every family first, then the ceremonies, then the receptions.
  for (const t of chosen) WEDDING_FUNCTIONS[t].filter((f) => !MAIN_CEREMONY.test(f)).forEach(add);
  for (const t of chosen) WEDDING_FUNCTIONS[t].filter((f) => MAIN_CEREMONY.test(f) && !RECEPTION.test(f)).forEach(add);
  for (const t of chosen) WEDDING_FUNCTIONS[t].filter((f) => RECEPTION.test(f)).forEach(add);
  return out.slice(0, MAX_FUNCTIONS);
}

export interface FunctionChoice {
  name: string;
  /** 1 = first day; 0 = before the main days (for example a bachelor party or a shoot). */
  day: number;
}

/**
 * Spreads functions over the days in order, keeping the main ceremony and
 * reception on the later days. Used to pre-fill the form; the host can move any of them.
 */
export function spreadOverDays(names: readonly string[], days: number): FunctionChoice[] {
  const total = Math.min(Math.max(1, Math.round(days)), MAX_DAYS);
  if (names.length === 0) return [];
  const main = names.filter((n) => MAIN_CEREMONY.test(n));
  const before = names.filter((n) => !MAIN_CEREMONY.test(n));
  // The ceremony and reception share the last day; with 4 or more days they get the last two.
  const mainDays = total >= 4 && main.length > 1 ? 2 : 1;
  const preDays = Math.max(1, total - mainDays);
  const out: FunctionChoice[] = [];
  before.forEach((name, i) => {
    out.push({ name, day: total === 1 ? 1 : 1 + Math.floor((i * preDays) / Math.max(1, before.length)) });
  });
  main.forEach((name, i) => {
    const day = total === 1 ? 1 : total - mainDays + 1 + Math.floor((i * mainDays) / main.length);
    out.push({ name, day: Math.min(total, day) });
  });
  return out;
}

/** "Day 2" or, for day 0, "Before the wedding". */
export function dayLabel(day: number): string {
  return day <= 0 ? "Before the main days" : `Day ${day}`;
}

/** The calendar date of a function's day (YYYY-MM-DD); day 1 is the event date. Day 0 has no fixed date. */
export function dateOfDay(firstDay: string, day: number): string | null {
  if (day <= 0) return null;
  return addDays(firstDay, day - 1);
}

/** Functions to plan: the host's own choices, or the usual set for their traditions if they chose none. */
export function functionsToPlan(input: {
  eventType: string;
  traditions: readonly Tradition[];
  days: number;
  functions: readonly FunctionChoice[];
}): FunctionChoice[] {
  if (input.functions.length > 0) {
    return input.functions.map((f) => ({ ...f, day: Math.min(f.day, input.days) }));
  }
  if (!MULTI_DAY_EVENT_TYPES.has(input.eventType) || input.days <= 1) return [];
  return spreadOverDays(usualFunctions(input.traditions, input.eventType), input.days);
}

/**
 * Modern additions that are a function of their own, and where they usually
 * fall. Sangeet choreography is practice, so it becomes tasks, not a function.
 */
export const ADDITION_FUNCTIONS: Partial<Record<ModernAddition, { name: string; day: "before" | "first" | "last" }>> = {
  bachelor: { name: "Bachelor / bachelorette party", day: "before" },
  shoot: { name: "Pre-wedding shoot", day: "before" },
  welcome: { name: "Welcome dinner", day: "first" },
  cocktail: { name: "Cocktail night", day: "first" },
  afterparty: { name: "After-party", day: "last" },
  brunch: { name: "Day-after brunch", day: "last" },
};

export function additionDay(where: "before" | "first" | "last", days: number): number {
  return where === "before" ? 0 : where === "first" ? 1 : Math.max(1, days);
}

/** Functions for the chosen traditions and days, plus any modern additions that are functions. */
export function suggestedFunctions(
  traditions: Tradition[],
  eventType: string,
  days: number,
  additions: ModernAddition[],
): FunctionChoice[] {
  // The host's family's functions plus the shared ceremonies are ticked; the other
  // family's extra functions are listed for the host to tick if they want them.
  const own = usualFunctions(traditions.slice(0, 1), eventType);
  const all = usualFunctions(traditions, eventType);
  const ticked = all.filter(
    (f) => own.includes(f) || /wedding|pheras|anand karaj|muhurt|nikah|church|reception|walima/i.test(f),
  );
  const base = days > 1 ? spreadOverDays(ticked, days) : [];
  const extra = additions
    .map((a) => ADDITION_FUNCTIONS[a])
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((x) => ({ name: x.name, day: additionDay(x.day, days) }));
  return [...extra.filter((e) => e.day === 0), ...base, ...extra.filter((e) => e.day !== 0)].slice(0, MAX_FUNCTIONS);
}

/** True when two function lists have the same names on the same days (order ignored). */
export function sameFunctions(a: readonly FunctionChoice[], b: readonly FunctionChoice[]): boolean {
  const key = (l: readonly FunctionChoice[]) =>
    l
      .map((f) => `${f.name}|${f.day}`)
      .sort()
      .join(";");
  return key(a) === key(b);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * The usual name for a function the host said ("pheras" → "Wedding (pheras)",
 * "haldi" → "Haldi (pithi)" for a Marwari family). The chosen traditions are
 * tried first, then every tradition and the modern additions; otherwise the
 * host's own word is kept.
 */
export function matchFunctionName(spoken: string, traditions: readonly Tradition[]): string {
  const said = norm(spoken);
  if (!said) return "";
  const lists = [
    usualFunctions(traditions, "wedding"),
    ...TRADITIONS.map((t) => WEDDING_FUNCTIONS[t]),
    Object.values(ADDITION_FUNCTIONS).flatMap((f) => (f ? [f.name] : [])),
  ];
  for (const list of lists) {
    const exact = list.find((name) => norm(name) === said);
    if (exact) return exact;
    const part = list.find((name) => {
      const words = norm(name).split(" ");
      return said.split(" ").every((w) => w.length >= 4 && words.some((x) => x.startsWith(w)));
    });
    if (part) return part;
  }
  const clean = spoken.trim().replace(/\s+/g, " ").slice(0, 40);
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}
