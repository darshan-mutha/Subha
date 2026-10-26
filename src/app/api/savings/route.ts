import { handleJson } from "@/lib/http";
import { SavingsRequestSchema, suggestSavings } from "@/lib/savings";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Ways to save money on the plan, so the host can choose one. */
export async function POST(request: Request) {
  return handleJson(request, SavingsRequestSchema, (body) => suggestSavings(body), { maxBytes: 12_000 });
}
