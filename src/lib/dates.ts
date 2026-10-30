/**
 * Calendar dates as YYYY-MM-DD strings. Event dates are calendar days in India,
 * so day maths is done on UTC midnights (no daylight saving, no time-zone
 * drift) and "today" is read in Asia/Kolkata.
 */

const DAY_MS = 86_400_000;
const IST = "Asia/Kolkata";

/** Midnight UTC of a YYYY-MM-DD date, in milliseconds (NaN when it isn't a date). */
function isoToUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** The YYYY-MM-DD date of a UTC-midnight timestamp. */
function utcMsToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from one date to another (to − from); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((isoToUtcMs(to) - isoToUtcMs(from)) / DAY_MS);
}

/** The date `days` days after `iso` (use a negative number for earlier). */
export function addDays(iso: string, days: number): string {
  return utcMsToIso(isoToUtcMs(iso) + days * DAY_MS);
}

const TODAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date (YYYY-MM-DD) in India. Event dates are compared in IST. */
export function todayIST(now: Date = new Date()): string {
  return TODAY_FORMAT.format(now);
}

/** Formats a YYYY-MM-DD date as a calendar day; anything that is not a date is returned as given. */
function formatIso(format: Intl.DateTimeFormat, iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return format.format(new Date(Date.UTC(y, m - 1, d)));
}

const SHORT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const SHORT_WITH_YEAR = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const LONG = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "UTC" });
const FULL = new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "UTC" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });

/** "9 Jan": day and short month, for compact lists. */
export function shortDate(iso: string): string {
  return formatIso(SHORT, iso);
}

/** "9 Jan 2027": day, short month and year. */
export function shortDateWithYear(iso: string): string {
  return formatIso(SHORT_WITH_YEAR, iso);
}

/** "9 January 2027": day, full month and year. */
export function longDate(iso: string): string {
  return formatIso(LONG, iso);
}

/** "Saturday, 9 January 2027": weekday, day, full month and year. */
export function fullDate(iso: string): string {
  return formatIso(FULL, iso);
}

/** The full date in another language ("शनिवार, 12 दिसंबर 2026"), by locale. */
export function fullDateIn(iso: string, locale: string): string {
  return formatIso(new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }), iso);
}

/** "Sat": the short weekday name. */
export function shortWeekday(iso: string): string {
  return formatIso(WEEKDAY_SHORT, iso);
}

/** A date written as YYYY-MM-DD. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a YYYY-MM-DD date that exists on the calendar (no 30 February). */
export function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
