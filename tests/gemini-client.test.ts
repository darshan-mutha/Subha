import { afterEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const { geminiGenerator } = await import("@/lib/gemini");

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  generateContent.mockReset();
});

describe("geminiGenerator", () => {
  it("refuses politely when no key is configured", async () => {
    await expect(geminiGenerator({ system: "s", prompt: "p", jsonSchema: {} })).rejects.toMatchObject({ status: 503 });
  });

  it("sends text with structured-output settings", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockResolvedValue({ text: '{"ok":true}' });
    const text = await geminiGenerator({ system: "rules", prompt: "plan it", jsonSchema: { type: "object" } });
    expect(text).toBe('{"ok":true}');
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe("gemini-flash-latest");
    expect(request.contents[0].parts).toEqual([{ text: "plan it" }]);
    expect(request.config).toMatchObject({ systemInstruction: "rules", responseMimeType: "application/json" });
  });

  it("attaches audio and honours a model override", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "gemini-test";
    generateContent.mockResolvedValue({ text: undefined });
    const text = await geminiGenerator({
      system: "s",
      prompt: "listen",
      jsonSchema: {},
      audio: { mimeType: "audio/webm", data: "QUJD" },
    });
    expect(text).toBe("");
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe("gemini-test");
    expect(request.contents[0].parts[0]).toEqual({ inlineData: { mimeType: "audio/webm", data: "QUJD" } });
  });
});
