import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create };
  },
}));

const { claudeGenerator, toClaudeSchema, DEFAULT_MODEL } = await import("@/lib/ai");

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.CLAUDE_MODEL;
  create.mockReset();
});

describe("toClaudeSchema", () => {
  it("closes every object and drops constraints Claude does not accept", () => {
    const out = toClaudeSchema({
      type: "object",
      properties: {
        name: { type: "string", maxLength: 40 },
        n: { type: "integer", minimum: 1, maximum: 9 },
        items: { type: "array", minItems: 3, maxItems: 9, items: { type: "object", properties: {} } },
        kind: { type: "string", enum: ["a", "b"] },
      },
      required: ["name"],
    });
    expect(out).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        n: { type: "integer" },
        items: { type: "array", minItems: 1, items: { type: "object", properties: {}, additionalProperties: false } },
        kind: { type: "string", enum: ["a", "b"] },
      },
      required: ["name"],
    });
  });
});

describe("claudeGenerator", () => {
  const req = { system: "rules", prompt: "plan it", jsonSchema: { type: "object", properties: {} } };

  it("refuses politely when no key is configured", async () => {
    await expect(claudeGenerator(req)).rejects.toMatchObject({ status: 503 });
    expect(create).not.toHaveBeenCalled();
  });

  it("sends the prompt with structured output, low effort and a reply cap", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: '{"ok":true}' }] });
    expect(await claudeGenerator({ ...req, maxTokens: 500 })).toBe('{"ok":true}');
    const body = create.mock.calls[0][0];
    expect(body.model).toBe(DEFAULT_MODEL);
    expect(body.system).toBe("rules");
    expect(body.max_tokens).toBe(500);
    expect(body.messages).toEqual([{ role: "user", content: "plan it" }]);
    expect(body.output_config.effort).toBe("low");
    expect(body.output_config.format).toEqual({
      type: "json_schema",
      schema: { type: "object", properties: {}, additionalProperties: false },
    });
  });

  it("honours a model override", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.CLAUDE_MODEL = "claude-haiku-5-5";
    create.mockResolvedValue({ stop_reason: "end_turn", content: [] });
    expect(await claudeGenerator(req)).toBe("");
    expect(create.mock.calls[0][0].model).toBe("claude-haiku-5-5");
  });

  it("turns refusals and API errors into safe messages", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    create.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    await expect(claudeGenerator(req)).rejects.toMatchObject({ status: 422 });
    create.mockRejectedValueOnce(Object.assign(new Error("rate"), { status: 429 }));
    await expect(claudeGenerator(req)).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/busy/) });
    create.mockRejectedValueOnce(Object.assign(new Error("bad key sk-ant-123"), { status: 401 }));
    await expect(claudeGenerator(req)).rejects.toMatchObject({
      status: 503,
      message: expect.not.stringMatching(/sk-ant/),
    });
    create.mockRejectedValueOnce(new Error("socket hang up"));
    await expect(claudeGenerator(req)).rejects.toMatchObject({ status: 502 });
  });
});
