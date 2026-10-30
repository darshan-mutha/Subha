import { z } from "zod";
import { HttpError, PLAN_NOT_FOUND } from "@/lib/errors";
import { errorResponse, handleJson, jsonResponse, withErrors } from "@/lib/http";
import { REPLY_ID } from "@/lib/rsvp";
import { getRsvpStore } from "@/lib/rsvpStore";
import { getStore } from "@/lib/store";
import { SHARE_ID } from "@/lib/team";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

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

/** The guest link and replies for a shared plan. */
export async function GET(_request: Request, context: Context) {
  return withErrors(
    async () => {
      const id = await planId(context);
      return id ? jsonResponse(await guestsOf(id)) : errorResponse(PLAN_NOT_FOUND, 404);
    },
    { log: "Guests load failure:", message: "Could not load guest replies. Please try again." },
  );
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
      if (!id) throw new HttpError(PLAN_NOT_FOUND, 404);
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
