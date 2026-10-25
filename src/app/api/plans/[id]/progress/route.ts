import { errorResponse, handleJson } from "@/lib/http";
import { PlannerError } from "@/lib/ai";
import { getStore } from "@/lib/store";
import { ProgressSchema, SHARE_ID } from "@/lib/team";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!SHARE_ID.test(id)) return errorResponse("This plan could not be found. The link may be wrong.", 404);
  return handleJson(
    request,
    ProgressSchema,
    async ({ itemId, done }) => {
      const updated = await getStore().setDone(id, itemId, done);
      if (!updated) throw new PlannerError("This plan could not be found. The link may be wrong.", 404);
      return { done: updated.done, updatedAt: updated.updatedAt };
    },
    { kind: "data" },
  );
}
