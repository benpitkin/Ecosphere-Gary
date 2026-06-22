import Anthropic from "@anthropic-ai/sdk";
import { resolveModel } from "@/gary/lib/reasoning";
import type { AskInput } from "@/gary/contracts/ask";
import type { KnowledgeChunk } from "@/gary/lib/rag";
import { ASK_SYSTEM_PROMPT, buildAskUserMessage } from "@/gary/lib/ask/prompt";

/**
 * Claude layer for ask-Gary.
 * ==========================
 *
 * Calls Claude with the grounded system prompt + conversation history + the
 * current question (and any retrieved KB passages), returning a structured
 * answer. Gated on `ANTHROPIC_API_KEY` — this capability is Claude-powered, so
 * without a key (or an injected client) it can't answer. Same conventions as the
 * other agents: JSON-schema structured output validated by zod, latest model,
 * adaptive thinking.
 */

export function isAskConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const ASK_ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    citedSources: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "confidence", "citedSources"],
  additionalProperties: false,
} as const;

export interface AskAnswer {
  answer: string;
  confidence: "low" | "medium" | "high";
  citedSources: string[];
}

export interface AskAgentDeps {
  client?: Pick<Anthropic["messages"], "create">;
  model?: string;
}

export async function answerQuestion(
  input: AskInput,
  passages: KnowledgeChunk[],
  deps: AskAgentDeps = {},
): Promise<AskAnswer> {
  const messages = deps.client ?? new Anthropic().messages;
  const model = deps.model ?? resolveModel();

  const conversation: Anthropic.MessageParam[] = [
    ...input.history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: buildAskUserMessage(input, passages) },
  ];

  const response = await messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: ASK_SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: ASK_ANSWER_SCHEMA } },
    messages: conversation,
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The answer was refused by the safety classifier.");
  }
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) {
    throw new Error(`Ask reasoning returned no text (stop_reason: ${response.stop_reason}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Ask reasoning returned non-JSON output.");
  }
  const out = parsed as AskAnswer;
  if (typeof out?.answer !== "string" || !out.answer.trim()) {
    throw new Error("Ask reasoning returned an empty answer.");
  }
  return {
    answer: out.answer,
    confidence: (["low", "medium", "high"] as const).includes(out.confidence) ? out.confidence : "medium",
    citedSources: Array.isArray(out.citedSources) ? out.citedSources.filter((s) => typeof s === "string") : [],
  };
}
