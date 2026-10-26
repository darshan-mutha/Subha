import type { Quote } from "./deals";
import type { ExtractResult } from "./extract";
import type { InviteDetails, InviteWording } from "./invite";
import type { SavingOption, SavingsRequest } from "./savings";
import type { GuestEvent, Reply } from "./rsvp";
import type { DayTimings } from "./muhurat";
import type { EventInput, Plan } from "./schemas";
import type { Assignments, Done, Member, SharedPlan, SharedPlanContent } from "./team";

export interface PlanResponse {
  input: EventInput;
  plan: Plan;
  timings: DayTimings | null;
  /** Present after a change request: what changed, in plain words. */
  changes?: string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiStatusError extends ApiError {
  constructor(
    message: string,
    public readonly status: number,
    fields: Record<string, string> = {},
  ) {
    super(message, fields);
  }
}

async function postJson<T>(
  url: string,
  body: unknown,
  isValid: (data: Partial<T>) => boolean,
  method: "POST" | "PUT" | "GET" = "POST",
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
  const data = (await res.json().catch(() => ({}))) as Partial<T> & {
    error?: string;
    fields?: Record<string, string>;
  };
  if (!res.ok || !isValid(data)) {
    throw new ApiStatusError(data.error || "Something went wrong. Please try again.", res.status, data.fields);
  }
  return data as T;
}

const post = (url: string, body: unknown) => postJson<PlanResponse>(url, body, (d) => Boolean(d.plan && d.input));

export const requestExtract = (body: { text: string }) =>
  postJson<ExtractResult>("/api/extract", body, (d) => Boolean(d.values));

export const requestPlan = (input: EventInput) => post("/api/plan", input);

export const requestRefine = (input: EventInput, plan: Plan, instruction: string) =>
  post("/api/refine", { input, plan, instruction });

export const requestAssign = (input: EventInput, plan: Plan, team: Member[]) =>
  postJson<{ assignments: Assignments }>("/api/assign", { input, plan, team }, (d) => Boolean(d.assignments));

export const requestAgreement = (body: {
  input: EventInput;
  vendor: { type: string; brief: string };
  quote: Quote;
  advance: number;
}) => postJson<{ text: string; source: "ai" | "standard" }>("/api/agreement", body, (d) => typeof d.text === "string");

export const requestInvite = (input: EventInput, details: InviteDetails) =>
  postJson<{ wording: InviteWording; source: "ai" | "standard" }>("/api/invite", { input, details }, (d) =>
    Boolean(d.wording?.heading),
  );

export const requestSavings = (body: SavingsRequest) =>
  postJson<{ options: SavingOption[]; source: "ai" | "standard" }>("/api/savings", body, (d) =>
    Array.isArray(d.options),
  );

export const createShared = (content: SharedPlanContent, done: Done) =>
  postJson<{ id: string }>("/api/plans", { ...content, done }, (d) => Boolean(d.id));

export const loadShared = (id: string) =>
  postJson<SharedPlan>(`/api/plans/${encodeURIComponent(id)}`, null, (d) => Boolean(d.plan), "GET");

export const updateShared = (id: string, version: number, content: SharedPlanContent) =>
  postJson<SharedPlan>(`/api/plans/${encodeURIComponent(id)}`, { version, content }, (d) => Boolean(d.plan), "PUT");

export const saveProgress = (id: string, itemId: string, done: boolean) =>
  postJson<{ done: Done }>(`/api/plans/${encodeURIComponent(id)}/progress`, { itemId, done }, (d) => Boolean(d.done));

export interface GuestsState {
  link: { token: string; open: boolean } | null;
  replies: Reply[];
}

export const loadGuests = (planId: string) =>
  postJson<GuestsState>(
    `/api/plans/${encodeURIComponent(planId)}/guests`,
    null,
    (d) => Array.isArray(d.replies),
    "GET",
  );

export const guestAction = (
  planId: string,
  body: { action: "open" } | { action: "close" } | { action: "remove"; replyId: string },
) => postJson<GuestsState>(`/api/plans/${encodeURIComponent(planId)}/guests`, body, (d) => Array.isArray(d.replies));

export const loadGuestEvent = (token: string) =>
  postJson<GuestEvent>(`/api/rsvp/${encodeURIComponent(token)}`, null, (d) => Boolean(d.title), "GET");

export const sendReply = (token: string, body: { reply: unknown; replyId?: string; secret?: string }) =>
  postJson<{ replyId: string; secret: string }>(`/api/rsvp/${encodeURIComponent(token)}`, body, (d) =>
    Boolean(d.replyId),
  );

/** A plan being worked on in this browser, before or without sharing. */
export interface LocalWorkspace extends SharedPlanContent {
  done: Done;
}

const STORAGE_KEY = "shuba:last-plan:v2";

export function savePlan(data: LocalWorkspace): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable (private mode); saving is optional */
  }
}

export function loadPlan(): LocalWorkspace | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalWorkspace) : null;
  } catch {
    return null;
  }
}

export function clearPlan(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Per-browser preference: whose tasks to show on a shared plan. */
export function loadViewer(planId: string): string {
  try {
    return localStorage.getItem(`shuba:viewer:${planId}`) ?? "";
  } catch {
    return "";
  }
}

export function saveViewer(planId: string, memberId: string): void {
  try {
    localStorage.setItem(`shuba:viewer:${planId}`, memberId);
  } catch {
    /* optional */
  }
}

/** Milestones whose celebration has already played on this device, per plan. */
export function loadBlooms(planKey: string): string[] | null {
  try {
    const raw = localStorage.getItem(`shuba:blooms:${planKey}`);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function saveBlooms(planKey: string, ids: string[]): void {
  try {
    localStorage.setItem(`shuba:blooms:${planKey}`, JSON.stringify(ids));
  } catch {
    /* optional */
  }
}
