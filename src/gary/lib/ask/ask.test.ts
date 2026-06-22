import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { askGary, ASK_DISCLAIMER } from "@/gary/lib/ask";
import { answerQuestion } from "@/gary/lib/ask/agent";
import { parseAskInput } from "@/gary/contracts/ask";
import type { KnowledgeChunk } from "@/gary/lib/rag";

const answer = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ answer: "At 45 °C/ΔT5 the MWT is 42.5 °C.", confidence: "high", citedSources: [], ...over });

const mockClient = (text: string, stop = "end_turn") =>
  ({ create: vi.fn(async () => ({ stop_reason: stop, content: [{ type: "text", text }] })) }) as unknown as Pick<
    Anthropic["messages"],
    "create"
  >;

describe("ask-Gary", () => {
  it("answers a technical question (no knowledge base)", async () => {
    const client = mockClient(answer());
    const result = await askGary(parseAskInput({ question: "What's the MWT at 45 °C flow?" }), { client });
    expect(result.answer).toMatch(/42\.5/);
    expect(result.confidence).toBe("high");
    expect(result.usedKnowledgeBase).toBe(false);
    expect(result.citations).toHaveLength(0);
    expect(result.disclaimer).toBe(ASK_DISCLAIMER);
  });

  it("passes conversation history through to the model", async () => {
    const create = vi.fn(async (args: { messages: Anthropic.MessageParam[] }) => {
      void args;
      return { stop_reason: "end_turn", content: [{ type: "text", text: answer() }] };
    });
    const client = { create } as unknown as Pick<Anthropic["messages"], "create">;
    await askGary(
      parseAskInput({
        question: "And at 50 °C?",
        history: [
          { role: "user", content: "MWT at 45?" },
          { role: "assistant", content: "42.5 °C" },
        ],
      }),
      { client },
    );
    const sentMessages = create.mock.calls[0][0].messages;
    expect(sentMessages).toHaveLength(3); // 2 history + current
    expect(sentMessages[0]).toEqual({ role: "user", content: "MWT at 45?" });
    expect(sentMessages[2].content).toContain("And at 50 °C?");
  });

  it("uses and cites retrieved knowledge-base passages", async () => {
    const passages: KnowledgeChunk[] = [
      { id: "1", content: "Stelrad Compact K2 600x1000 delivers 1234 W at ΔT50.", source: "stelrad-catalogue" },
    ];
    const client = mockClient(answer({ citedSources: ["stelrad-catalogue"] }));
    const result = await askGary(parseAskInput({ question: "Output of a K2 600x1000?" }), {
      client,
      retrieve: async () => passages,
    });
    expect(result.usedKnowledgeBase).toBe(true);
    expect(result.citations[0].source).toBe("stelrad-catalogue");
    expect(result.citations[0].snippet).toContain("Stelrad");
  });

  it("requires ANTHROPIC_API_KEY when no client is injected", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(askGary(parseAskInput({ question: "hi" }))).rejects.toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it("rejects a refusal from the model", async () => {
    const client = mockClient("", "refusal");
    await expect(answerQuestion(parseAskInput({ question: "hi" }), [], { client })).rejects.toThrow(/refus/i);
  });

  it("rejects an empty answer", async () => {
    const client = mockClient(JSON.stringify({ answer: "  ", confidence: "low", citedSources: [] }));
    await expect(answerQuestion(parseAskInput({ question: "hi" }), [], { client })).rejects.toThrow(/empty/i);
  });
});
