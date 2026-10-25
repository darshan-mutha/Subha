import { handleJson } from "@/lib/http";
import { refinePlan } from "@/lib/planner";
import { makeRefineSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleJson(request, makeRefineSchema(), ({ input, plan, instruction }) =>
    refinePlan(input, plan, instruction),
  );
}
