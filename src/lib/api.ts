import type { WeatherSummary } from "./weather";
import type { Quote } from "./deals";
import type { ExtractResult } from "./extract";
import type { IdeasRequest, IdeasResult } from "./ideas";
import type { InviteDetails, InviteWording } from "./invite";
import type { PlanResult } from "./planner";
import type { SavingOption, SavingsRequest } from "./savings";
import type { GuestEvent, Reply } from "./rsvp";
import type { GuestGroupIdea } from "./guestGroups";
import type { EventInput, Plan } from "./schemas";
import type { Assignments, Done, Member, SharedPlan, SharedPlanContent } from "./team";

/** A request failed; `message` is safe to show, `fields` holds per-field messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** The server answered with an error; `status` is its HTTP status. */
export class ApiStatusError extends ApiError {
  constructor(
    message: string,
    public readonly status: number,
    fields: Record<string, string> = {},
  ) {
    super(message, fields);
  }
}

type Method = "GET" | "POST" | "PUT";

/** What the server sends back when something goes wrong. */
interface ErrorBody {
  error?: string;
  fields?: Record<string, string>;
}

/**
 * Calls one of Shubā's API routes with an optional JSON body and returns the
 * JSON reply once `isValid` accepts it. Network failures, error statuses and
 * replies of the wrong shape all become an `ApiError` with a message to show.
 */
export async function requestJson<T>(
  method: Method,
  url: string,
  isValid: (data: Partial<T>) => boolean,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not reach Shubā. Please check your internet connection.");
  }
  const data: Partial<T> & ErrorBody = await res.json().catch(() => ({}));
  if (!res.ok || !isValid(data)) {
    throw new ApiStatusError(data.error || "Something went wrong. Please try again.", res.status, data.fields);
  }
  // `isValid` has checked the fields the caller relies on.
  return data as T;
}

const planPath = (id: string) => `/api/plans/${encodeURIComponent(id)}`;
const isPlanResult = (d: Partial<PlanResult>) => Boolean(d.plan && d.input);

export const requestExtract = (body: { text: string }) =>
  requestJson<ExtractResult>("POST", "/api/extract", (d) => Boolean(d.values), body);

export const requestPlan = (input: EventInput) => requestJson<PlanResult>("POST", "/api/plan", isPlanResult, input);

export const requestRefine = (input: EventInput, plan: Plan, instruction: string) =>
  requestJson<PlanResult>("POST", "/api/refine", isPlanResult, { input, plan, instruction });

export const requestAssign = (input: EventInput, plan: Plan, team: Member[]) =>
  requestJson<{ assignments: Assignments }>("POST", "/api/assign", (d) => Boolean(d.assignments), {
    input,
    plan,
    team,
  });

export const requestAgreement = (body: {
  input: EventInput;
  vendor: { type: string; brief: string };
  quote: Quote;
  advance: number;
}) =>
  requestJson<{ text: string; source: "ai" | "standard" }>(
    "POST",
    "/api/agreement",
    (d) => typeof d.text === "string",
    body,
  );

export const requestInvite = (input: EventInput, details: InviteDetails) =>
  requestJson<{ wording: InviteWording; source: "ai" | "standard" }>(
    "POST",
    "/api/invite",
    (d) => Boolean(d.wording?.heading),
    { input, details },
  );

export const requestSavings = (body: SavingsRequest) =>
  requestJson<{ options: SavingOption[]; source: "ai" | "standard" }>(
    "POST",
    "/api/savings",
    (d) => Array.isArray(d.options),
    body,
  );

export const requestIdeas = (body: IdeasRequest) =>
  requestJson<IdeasResult>(
    "POST",
    "/api/ideas",
    (d) => ("directions" in d && Array.isArray(d.directions)) || ("items" in d && Array.isArray(d.items)),
    body,
  );

export const requestGuestGroups = (body: { input: EventInput; functions: string[] }) =>
  requestJson<{ groups: GuestGroupIdea[]; reminders: string[]; source: "ai" | "standard" }>(
    "POST",
    "/api/guestlist",
    (d) => Array.isArray(d.groups),
    body,
  );

export const createShared = (content: SharedPlanContent, done: Done) =>
  requestJson<{ id: string }>("POST", "/api/plans", (d) => Boolean(d.id), { ...content, done });

export const loadShared = (id: string) => requestJson<SharedPlan>("GET", planPath(id), (d) => Boolean(d.plan));

export const updateShared = (id: string, version: number, content: SharedPlanContent) =>
  requestJson<SharedPlan>("PUT", planPath(id), (d) => Boolean(d.plan), { version, content });

export const saveProgress = (id: string, itemId: string, done: boolean) =>
  requestJson<{ done: Done }>("POST", `${planPath(id)}/progress`, (d) => Boolean(d.done), { itemId, done });

/** A shared plan's guest reply link (if turned on) and the replies so far. */
export interface GuestsState {
  link: { token: string; open: boolean } | null;
  replies: Reply[];
}

export const loadGuests = (planId: string) =>
  requestJson<GuestsState>("GET", `${planPath(planId)}/guests`, (d) => Array.isArray(d.replies));

export const guestAction = (
  planId: string,
  body: { action: "open" } | { action: "close" } | { action: "remove"; replyId: string },
) => requestJson<GuestsState>("POST", `${planPath(planId)}/guests`, (d) => Array.isArray(d.replies), body);

export const loadGuestEvent = (token: string) =>
  requestJson<GuestEvent>("GET", `/api/rsvp/${encodeURIComponent(token)}`, (d) => Boolean(d.title));

export const sendReply = (token: string, body: { reply: unknown; replyId?: string; secret?: string }) =>
  requestJson<{ replyId: string; secret: string }>(
    "POST",
    `/api/rsvp/${encodeURIComponent(token)}`,
    (d) => Boolean(d.replyId),
    body,
  );

export const requestWeather = (body: { city: string; date: string; days: number }) =>
  requestJson<WeatherSummary>("POST", "/api/weather", (d) => typeof d.kind === "string", body);
