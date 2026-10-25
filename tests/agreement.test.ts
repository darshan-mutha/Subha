import { describe, expect, it, vi } from "vitest";
import { PlannerError } from "@/lib/ai";
import {
  AgreementRequestSchema,
  buildAgreementPrompt,
  composeAgreement,
  draftAgreement,
  standardSections,
  type AgreementRequest,
} from "@/lib/agreement";
import { baseInput } from "./fixtures";

const request: AgreementRequest = {
  input: baseInput,
  vendor: { type: "Caterer", brief: "Hi, we need snacks for 40." },
  quote: {
    id: "qa",
    vendorName: "Annapoorna Caterers",
    phone: "98450 12345",
    amount: 24000,
    includes: "Snacks, cake, 2 serving staff",
  },
  advance: 5000,
};

const aiReply = JSON.stringify({
  scope: ["Snacks and a jungle cake for 40 children and parents", "Two serving staff from 3 PM to 6 PM"],
  terms: ["Arrive by 2 PM to set up", "Guest changes told 3 days before"],
});

describe("composeAgreement", () => {
  it("fills prices and dates from the host's numbers", () => {
    const text = composeAgreement(request, standardSections("Caterer", request.quote));
    expect(text).toContain("BOOKING CONFIRMATION – CATERER");
    expect(text).toContain("Event: Aarav turns 5");
    expect(text).toContain("Date: 12 December 2026");
    expect(text).toContain("Total agreed price: ₹24,000");
    expect(text).toContain("Advance paid: ₹5,000");
    expect(text).toContain("Balance: ₹19,000, to be paid on or before 12 December 2026");
    expect(text).toContain("Vendor: Annapoorna Caterers   Phone: 98450 12345");
    expect(text).toContain("Includes: Snacks, cake, 2 serving staff.");
    expect(text).toContain("This is not legal advice.");
  });

  it("handles no advance and no phone, and never counts an advance above the price", () => {
    const none = composeAgreement(
      { ...request, advance: 0, quote: { ...request.quote, phone: "", includes: "" } },
      standardSections("Caterer", { ...request.quote, includes: "" }),
    );
    expect(none).toContain("Advance: to be paid on signing");
    expect(none).toContain("Phone: ______________");
    expect(none).not.toContain("Includes:");
    const over = composeAgreement({ ...request, advance: 99999 }, { scope: ["x"], terms: ["y"] });
    expect(over).toContain("Balance: ₹0");
  });

  it("uses the event type when there is no event name", () => {
    const text = composeAgreement(
      { ...request, input: { ...baseInput, eventName: "" } },
      { scope: ["x"], terms: ["y"] },
    );
    expect(text).toContain("Event: Birthday");
  });
});

describe("draftAgreement", () => {
  it("uses Claude's scope and terms, keeping numbers in code", async () => {
    const generate = vi.fn().mockResolvedValue(aiReply);
    const result = await draftAgreement(request, generate);
    expect(result.source).toBe("ai");
    expect(result.text).toContain("• Two serving staff from 3 PM to 6 PM");
    expect(result.text).toContain("Total agreed price: ₹24,000");
    const call = generate.mock.calls[0][0];
    expect(call.system).toContain("Never write any price");
    expect(call.prompt).toContain("<user_details>");
    expect(call.prompt).not.toContain("24000");
  });

  it("falls back to standard wording when the AI fails", async () => {
    const generate = vi.fn().mockRejectedValue(new PlannerError("busy", 503));
    const result = await draftAgreement(request, generate);
    expect(result.source).toBe("standard");
    expect(result.text).toContain("Caterer services for the event");
  });

  it("falls back when the AI reply is malformed", async () => {
    const result = await draftAgreement(request, vi.fn().mockResolvedValue('{"scope": []}'));
    expect(result.source).toBe("standard");
  });

  it("passes refusals through", async () => {
    const generate = vi.fn().mockRejectedValue(new PlannerError("no", 422));
    await expect(draftAgreement(request, generate)).rejects.toMatchObject({ status: 422 });
  });
});

describe("request validation and prompt", () => {
  it("accepts a valid request and rejects a bad quote", () => {
    expect(AgreementRequestSchema.safeParse(request).success).toBe(true);
    expect(
      AgreementRequestSchema.safeParse({ ...request, quote: { ...request.quote, vendorName: "<x>" } }).success,
    ).toBe(false);
  });

  it("marks host text as data", () => {
    const prompt = buildAgreementPrompt({ ...request, vendor: { type: "Caterer", brief: "" } });
    expect(prompt).toContain("Vendor type: Caterer");
    expect(prompt).toContain("Brief the host sent: not stated");
  });
});

describe("POST /api/agreement", () => {
  it("returns a draft (standard wording when the AI is not configured)", async () => {
    const { POST } = await import("@/app/api/agreement/route");
    const res = await POST(
      new Request("http://localhost/api/agreement", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" },
        body: JSON.stringify(request),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.source).toBe("standard");
    expect(data.text).toContain("Total agreed price: ₹24,000");
  });

  it("rejects invalid requests", async () => {
    const { POST } = await import("@/app/api/agreement/route");
    const res = await POST(
      new Request("http://localhost/api/agreement", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.8" },
        body: JSON.stringify({ ...request, quote: { ...request.quote, amount: -5 } }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
