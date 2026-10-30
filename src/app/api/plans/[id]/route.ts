import { z } from "zod";
import { PLAN_NOT_FOUND } from "@/lib/errors";
import { errorResponse, handleJson, jsonResponse, withErrors } from "@/lib/http";
import { getStore } from "@/lib/store";
import { SHARE_ID, makeSharedContentSchema } from "@/lib/team";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function shareId(context: Context): Promise<string | null> {
  const { id } = await context.params;
  return SHARE_ID.test(id) ? id : null;
}

/** Loads a shared plan for anyone with the team link. */
export async function GET(_request: Request, context: Context) {
  const id = await shareId(context);
  if (!id) return errorResponse(PLAN_NOT_FOUND, 404);
  return withErrors(
    async () => {
      const plan = await getStore().get(id);
      return plan ? jsonResponse(plan) : errorResponse(PLAN_NOT_FOUND, 404);
    },
    { log: "Load failure:", message: "Could not load the plan. Please try again." },
  );
}

/** Saves a new version of a shared plan. Fails with 409 if someone else saved first. */
export async function PUT(request: Request, context: Context) {
  const id = await shareId(context);
  if (!id) return errorResponse(PLAN_NOT_FOUND, 404);
  const schema = z.object({ version: z.number().int().positive(), content: makeSharedContentSchema() });
  return handleJson(request, schema, ({ version, content }) => getStore().update(id, content, version), {
    maxBytes: 256_000,
    kind: "data",
  });
}
