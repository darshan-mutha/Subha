import { handleJson } from "@/lib/http";
import { createPlan } from "@/lib/planner";
import { makeEventInputSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleJson(request, makeEventInputSchema(), (input) => createPlan(input));
}
