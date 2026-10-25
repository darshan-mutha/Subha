import { AssignRequestSchema, assignTasks } from "@/lib/assign";
import { handleJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleJson(request, AssignRequestSchema, async ({ input, plan, team }) => ({
    assignments: await assignTasks(input.eventType, plan, team),
  }));
}
