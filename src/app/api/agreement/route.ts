import { AgreementRequestSchema, draftAgreement } from "@/lib/agreement";
import { handleJson } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Drafts a one-page vendor confirmation. Prices and dates are filled in by code. */
export async function POST(request: Request) {
  return handleJson(request, AgreementRequestSchema, (body) => draftAgreement(body), { maxBytes: 8_000 });
}
