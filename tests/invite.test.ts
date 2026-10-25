import { describe, expect, it, vi } from "vitest";
import { PlannerError } from "@/lib/ai";
import {
  buildInvitePrompt,
  draftInvite,
  EMPTY_DETAILS,
  inviteAltText,
  inviteDate,
  inviteFacts,
  inviteMessage,
  InviteDetailsSchema,
  InviteRequestSchema,
  InviteSchema,
  inviteVenue,
  standardWording,
  type InviteRequest,
} from "@/lib/invite";
import { wrapText } from "@/lib/inviteCard";
import { makeSharedContentSchema } from "@/lib/team";
import { baseInput, NOW, samplePlan } from "./fixtures";

const request: InviteRequest = {
  input: baseInput,
  details: { ...EMPTY_DETAILS, hosts: "The Rao family", venue: "Sunshine Clubhouse", time: "4:00 PM" },
};

const wording = {
  heading: "You're invited!",
  message: "Join us for Aarav's jungle safari birthday.",
  closing: "With love, the Rao family",
};

describe("invite facts (always from the host, never the AI)", () => {
  it("writes the date in the invite's language", () => {
    expect(inviteDate("2026-12-12", "en")).toBe("Saturday, 12 December 2026");
    expect(inviteDate("2026-12-12", "hi")).toContain("दिसंबर");
    expect(inviteDate("2026-12-12", "kn")).toContain("ಡಿಸೆಂಬರ್");
  });

  it("adds the city to the venue only when it is missing", () => {
    expect(inviteVenue("Sunshine Clubhouse", "Bengaluru")).toBe("Sunshine Clubhouse, Bengaluru");
    expect(inviteVenue("Palace Grounds, Bengaluru", "Bengaluru")).toBe("Palace Grounds, Bengaluru");
    expect(inviteVenue("  ", "Bengaluru")).toBe("Bengaluru");
  });

  it("builds the WhatsApp message with the facts and skips empty lines", () => {
    const text = inviteMessage(wording, inviteFacts(baseInput, request.details));
    expect(text).toBe(
      "*You're invited!*\n\nJoin us for Aarav's jungle safari birthday.\n\n📅 Saturday, 12 December 2026\n⏰ 4:00 PM\n📍 Sunshine Clubhouse, Bengaluru\n\nWith love, the Rao family",
    );
    const bare = inviteMessage(wording, inviteFacts(baseInput, EMPTY_DETAILS));
    expect(bare).not.toContain("⏰");
    expect(bare).toContain("📍 Bengaluru");
  });

  it("gives screen readers the whole card in one line", () => {
    const alt = inviteAltText(wording, inviteFacts(baseInput, request.details));
    expect(alt).toBe(
      "Invitation card. You're invited! Join us for Aarav's jungle safari birthday. Saturday, 12 December 2026, 4:00 PM, Sunshine Clubhouse, Bengaluru. With love, the Rao family",
    );
  });
});

describe("invite details", () => {
  it("falls back to English and a warm tone for unknown choices", () => {
    const d = InviteDetailsSchema.parse({ language: "fr", tone: "angry" });
    expect(d).toEqual(EMPTY_DETAILS);
  });

  it("accepts names in Indian scripts and blocks markup", () => {
    expect(InviteDetailsSchema.safeParse({ hosts: "शर्मा परिवार" }).success).toBe(true);
    expect(InviteDetailsSchema.safeParse({ hosts: "<script>" }).success).toBe(false);
    expect(InviteDetailsSchema.safeParse({ note: "x".repeat(161) }).success).toBe(false);
  });

  it("tidies saved words and rejects empty or unsafe ones", () => {
    const saved = InviteSchema.parse({ details: {}, wording: { ...wording, message: "  Join   us\n soon " } });
    expect(saved.wording.message).toBe("Join us soon");
    expect(saved.look).toBe("peacock");
    expect(InviteSchema.safeParse({ details: {}, wording: { ...wording, heading: " " } }).success).toBe(false);
    expect(InviteSchema.safeParse({ details: {}, wording: { ...wording, closing: "<b>hi</b>" } }).success).toBe(false);
  });

  it("is saved with shared plans, and old plans without one still load", () => {
    const schema = makeSharedContentSchema(NOW);
    const base = { input: baseInput, plan: samplePlan };
    expect(schema.parse(base).invite).toBeNull();
    const withInvite = schema.parse({ ...base, invite: { details: request.details, wording, look: "haldi" } });
    expect(withInvite.invite?.look).toBe("haldi");
    expect(schema.parse({ ...base, invite: { broken: true } }).invite).toBeNull();
  });
});

describe("invite words (Claude)", () => {
  it("asks for the language and tone, and keeps host text inside user_details", () => {
    const prompt = buildInvitePrompt({ ...request, details: { ...request.details, language: "ta", tone: "formal" } });
    expect(prompt).toContain("Language: Tamil");
    expect(prompt).toContain("Tone: traditional");
    expect(prompt).toMatch(/<user_details>[\s\S]*Hosted by: The Rao family[\s\S]*<\/user_details>/);
    // Facts are printed by code, so they are never sent for the AI to rewrite.
    expect(prompt).not.toContain("Sunshine Clubhouse");
    expect(prompt).not.toContain("4:00 PM");
    expect(prompt).not.toContain(String(baseInput.budget));
  });

  it("returns Claude's words when the reply is valid", async () => {
    const generate = vi.fn(async () => JSON.stringify(wording));
    const result = await draftInvite(request, generate);
    expect(result).toEqual({ wording, source: "ai" });
    expect(generate).toHaveBeenCalledOnce();
  });

  it("falls back to standard English words when the AI is busy", async () => {
    const generate = vi.fn(async () => {
      throw new PlannerError("busy", 503);
    });
    const result = await draftInvite({ ...request, details: { ...request.details, language: "hi" } }, generate);
    expect(result.source).toBe("standard");
    expect(result.wording.message).toContain("Aarav turns 5");
    expect(result.wording.closing).toBe("With love, The Rao family");
  });

  it("does not hide a refusal", async () => {
    const generate = vi.fn(async () => {
      throw new PlannerError("no", 422);
    });
    await expect(draftInvite(request, generate)).rejects.toMatchObject({ status: 422 });
  });

  it("standard words fit the tone and work without hosts or an event name", () => {
    const formal = standardWording({ ...baseInput, eventName: "" }, { ...EMPTY_DETAILS, tone: "formal" });
    expect(formal.heading).toBe("You are cordially invited");
    expect(formal.message).toContain("our birthday");
    expect(formal.closing).toBe("We look forward to celebrating with you.");
  });

  it("validates requests, allowing a plan whose date has just passed", () => {
    const past = { ...baseInput, date: "2026-01-01" };
    expect(InviteRequestSchema.safeParse({ input: past, details: {} }).success).toBe(true);
    expect(InviteRequestSchema.safeParse({ input: { ...baseInput, city: "" }, details: {} }).success).toBe(false);
  });
});

describe("POST /api/invite", () => {
  it("returns standard words when the AI is not set up, and rejects bad input", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { POST } = await import("@/app/api/invite/route");
    const send = (body: unknown, ip: string) =>
      POST(
        new Request("http://localhost/api/invite", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify(body),
        }),
      );
    const ok = await send(request, "10.9.0.1");
    expect(ok.status).toBe(200);
    expect((await ok.json()).source).toBe("standard");
    const bad = await send({ input: baseInput, details: { hosts: "<x>" } }, "10.9.0.2");
    expect(bad.status).toBe(400);
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});

describe("wrapText", () => {
  const measure = (s: string) => s.length * 10;

  it("wraps on spaces to fit the width", () => {
    expect(wrapText("one two three four", 90, measure)).toEqual(["one two", "three", "four"]);
  });

  it("breaks a word that is longer than a line", () => {
    expect(wrapText("abcdefghij", 40, measure)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("keeps Indian letters whole when breaking", () => {
    const lines = wrapText("नमस्तेनमस्ते", 30, measure);
    expect(lines.join("")).toBe("नमस्तेनमस्ते");
    expect(lines.every((l) => !/^[ा-्]/u.test(l))).toBe(true);
  });

  it("cuts very long text with an ellipsis", () => {
    const lines = wrapText("a b c d e f g h", 10, measure, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith("…")).toBe(true);
  });
});

describe("drawInviteCard", () => {
  /** A stand-in canvas that records the text drawn, with widths based on font size. */
  function fakeContext() {
    const texts: { text: string; y: number; font: string }[] = [];
    const ctx = {
      font: "",
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      textAlign: "",
      textBaseline: "",
      measureText: (s: string) => ({ width: s.length * Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10) * 0.55 }),
      fillText: (text: string, _x: number, y: number) => texts.push({ text, y, font: ctx.font }),
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      fillRect: () => undefined,
      beginPath: () => undefined,
      closePath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      arcTo: () => undefined,
      arc: () => undefined,
      quadraticCurveTo: () => undefined,
      stroke: () => undefined,
      fill: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      translate: () => undefined,
      rotate: () => undefined,
      scale: () => undefined,
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
  }

  const fonts = { display: "Fraunces, serif", body: "Inter, sans-serif" };

  it("draws the words, the facts and the footer inside the card", async () => {
    vi.stubGlobal("Path2D", class {});
    const { drawInviteCard, CARD_HEIGHT } = await import("@/lib/inviteCard");
    const { ctx, texts } = fakeContext();
    const facts = inviteFacts(baseInput, request.details);
    drawInviteCard(ctx, wording, facts, "ivory", fonts);
    const drawn = texts.map((t) => t.text).join(" ");
    for (const part of [wording.heading, facts.date, facts.time, facts.venue, "With love,", "Made with Shubā"]) {
      expect(drawn).toContain(part);
    }
    expect(texts.every((t) => t.y > 300 && t.y < CARD_HEIGHT - 60)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("shrinks a long invitation so it still fits", async () => {
    vi.stubGlobal("Path2D", class {});
    const { drawInviteCard, CARD_HEIGHT } = await import("@/lib/inviteCard");
    const { ctx, texts } = fakeContext();
    const long = { ...wording, message: "We would be delighted to have you with us. ".repeat(9).trim() };
    drawInviteCard(
      ctx,
      long,
      inviteFacts(baseInput, { ...request.details, note: "Dress code: ethnic" }),
      "peacock",
      fonts,
    );
    const body = texts.filter((t) => t.font.startsWith("400") && !t.text.startsWith("Made"));
    expect(Number(/(\d+)px/.exec(body[0].font)?.[1])).toBeLessThan(40);
    expect(texts.at(-2)!.y).toBeLessThan(CARD_HEIGHT - 140);
    vi.unstubAllGlobals();
  });
});
