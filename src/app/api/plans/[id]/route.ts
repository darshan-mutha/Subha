import { z } from "zod";
import { PlannerError } from "@/lib/ai";
import { errorResponse, handleJson, jsonResponse } from "@/lib/http";
import { getStore } from "@/lib/store";
import { SHARE_ID, makeSharedContentSchema } from "@/lib/team";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function shareId(context: Context): Promise<string | null> {
  const { id } = await context.params;
  return SHARE_ID.test(id) ? id : null;
}

export async function GET(_request: Request, context: Context) {
  const id = await shareId(context);
  if (!id) return errorResponse("This plan could not be found. The link may be wrong.", 404);
  try {
    const plan = await getStore().get(id);
    if (!plan) return errorResponse("This plan could not be found. The link may be wrong.", 404);
    return jsonResponse(plan);
  } catch (error) {
    if (error instanceof PlannerError) return errorResponse(error.message, error.status);
    console.error("Load failure:", error instanceof Error ? error.message : "unknown error");
    return errorResponse("Could not load the plan. Please try again.", 500);
  }
}

export async function PUT(request: Request, context: Context) {
  const id = await shareId(context);
  if (!id) return errorResponse("This plan could not be found. The link may be wrong.", 404);
  const schema = z.object({ version: z.number().int().positive(), content: makeSharedContentSchema() });
  return handleJson(request, schema, ({ version, content }) => getStore().update(id, content, version), {
    maxBytes: 128_000,
    kind: "data",
  });
}
