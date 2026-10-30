import { HttpError, PLAN_NOT_FOUND } from "@/lib/errors";
import { errorResponse, handleJson } from "@/lib/http";
import { getStore } from "@/lib/store";
import { ProgressSchema, SHARE_ID } from "@/lib/team";

export const runtime = "nodejs";

/** Ticks or unticks one item on a shared plan. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!SHARE_ID.test(id)) return errorResponse(PLAN_NOT_FOUND, 404);
  return handleJson(
    request,
    ProgressSchema,
    async ({ itemId, done }) => {
      const updated = await getStore().setDone(id, itemId, done);
      if (!updated) throw new HttpError(PLAN_NOT_FOUND, 404);
      return { done: updated.done, updatedAt: updated.updatedAt };
    },
    { kind: "data" },
  );
}
