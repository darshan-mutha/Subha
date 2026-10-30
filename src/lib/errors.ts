/**
 * An error whose message is safe to show to the visitor. API routes turn it
 * into a JSON reply with this status (and per-field messages when given).
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** An HttpError raised while planning with AI. Kept as its own name for older imports. */
export class PlannerError extends HttpError {
  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message, status, fields);
    this.name = "PlannerError";
  }
}

/** Shown whenever a shared plan link does not lead to a saved plan. */
export const PLAN_NOT_FOUND = "This plan could not be found. The link may be wrong.";
