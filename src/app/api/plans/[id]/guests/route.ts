import { z } from "zod";
import { PlannerError } from "@/lib/ai";
import { errorResponse, handleJson, jsonResponse } from "@/lib/http";
import { REPLY_ID } from "@/lib/rsvp";
import { getRsvpStore } from "@/lib/rsvpStore";
import { getStore } from "@/lib/store";
import { SHARE_ID } from "@/lib/team";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const NOT_FOUND = "This plan could not be found. The link may be wrong.";

/** Guest link and replies, for anyone with the team link. */
async function guestsOf(planId: string) {
  const store = getRsvpStore();
  const [link, replies] = await Promise.all([store.getLinkForPlan(planId), store.listReplies(planId)]);
  return { link: link ? { token: link.token, open: link.open } : null, replies };
}

async function planId(context: Context): Promise<string | null> {
  const { id } = await context.params;
  if (!SHARE_ID.test(id)) return null;
  return (await getStore().get(id)) ? id : null;
}

export async function GET(_request: Request, context: Context) {
  try {
    const id = await planId(context);
    if (!id) return errorResponse(NOT_FOUND, 404);
    return jsonResponse(await guestsOf(id));
  } catch (error) {
    if (error instanceof PlannerError) return errorResponse(error.message, error.status);
    console.error("Guests load failure:", error instanceof Error ? error.message : "unknown error");
    return errorResponse("Could not load guest replies. Please try again.", 500);
  }
}

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open") }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("remove"), replyId: z.string().regex(REPLY_ID) }),
]);

/** Turns guest replies on or off, or removes a reply. */
export async function POST(request: Request, context: Context) {
  return handleJson(
    request,
    ActionSchema,
    async (body) => {
      const id = await planId(context);
      if (!id) throw new PlannerError(NOT_FOUND, 404);
      const store = getRsvpStore();
      if (body.action === "open") {
        const link = await store.openLink(id);
        if (!link.open) await store.setOpen(id, true);
      } else if (body.action === "close") {
        await store.setOpen(id, false);
      } else {
        await store.removeReply(id, body.replyId);
      }
      return guestsOf(id);
    },
    { maxBytes: 2_000, kind: "data" },
  );
}
