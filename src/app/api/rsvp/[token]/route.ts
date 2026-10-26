import { PlannerError } from "@/lib/ai";
import { errorResponse, handleJson, jsonResponse } from "@/lib/http";
import { guestEvent, ReplyInputSchema, RSVP_TOKEN, SubmitReplySchema } from "@/lib/rsvp";
import { getRsvpStore } from "@/lib/rsvpStore";
import { getStore } from "@/lib/store";
import { fieldErrors } from "@/lib/schemas";

export const runtime = "nodejs";

type Context = { params: Promise<{ token: string }> };

const NOT_FOUND = "This invitation link could not be found. Please check it with the hosts.";

async function lookup(context: Context) {
  const { token } = await context.params;
  if (!RSVP_TOKEN.test(token)) return null;
  const link = await getRsvpStore().getLink(token);
  if (!link) return null;
  const plan = await getStore().get(link.planId);
  return plan ? { link, plan } : null;
}

/** What a guest sees: the invitation only, never the plan or budget. */
export async function GET(_request: Request, context: Context) {
  try {
    const found = await lookup(context);
    if (!found) return errorResponse(NOT_FOUND, 404);
    return jsonResponse(guestEvent(found.plan.input, found.plan.invite, found.link.open));
  } catch (error) {
    if (error instanceof PlannerError) return errorResponse(error.message, error.status);
    console.error("RSVP load failure:", error instanceof Error ? error.message : "unknown error");
    return errorResponse("Could not load the invitation. Please try again.", 500);
  }
}

/** A guest replies, or changes their reply. */
export async function POST(request: Request, context: Context) {
  return handleJson(
    request,
    SubmitReplySchema,
    async ({ reply, replyId, secret }) => {
      const parsed = ReplyInputSchema.safeParse(reply);
      if (!parsed.success) {
        const fields = fieldErrors(parsed.error);
        throw Object.assign(new PlannerError(Object.values(fields)[0] ?? "Please check your reply.", 400), {
          fields,
        });
      }
      const found = await lookup(context);
      if (!found) throw new PlannerError(NOT_FOUND, 404);
      if (!found.link.open) throw new PlannerError("The hosts are no longer taking replies.", 403);
      const saved = await getRsvpStore().saveReply(found.link.planId, parsed.data, replyId, secret);
      return { replyId: saved.id, secret: saved.secret };
    },
    { maxBytes: 4_000, kind: "data" },
  );
}
