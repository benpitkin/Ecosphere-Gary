import Anthropic from "@anthropic-ai/sdk";
import { resolveModel } from "@/gary/lib/reasoning";
import { ReviewSuggestions, type ReviewInput } from "@/gary/contracts/review";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserMessage } from "@/gary/lib/review/prompt";
import type { ChecksOutput } from "@/gary/lib/review/checks";

/**
 * Claude reasoning layer for the design/quote reviewer.
 * ====================================================
 *
 * Turns the deterministic checks into improvement suggestions. Gated on
 * `ANTHROPIC_API_KEY`; without it the orchestrator returns the deterministic
 * findings alone. Same pattern as the solar agent: JSON-schema structured output,
 * validated by our own zod schema; model defaults to the latest Claude.
 */

export function isReviewReasoningConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const REVIEW_SUGGESTIONS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    suggestions: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["summary", "suggestions", "confidence"],
  additionalProperties: false,
} as const;

export interface ReviewAgentDeps {
  client?: Pick<Anthropic["messages"], "create">;
  model?: string;
}

export async function writeReviewSuggestions(
  input: ReviewInput,
  checks: ChecksOutput,
  deps: ReviewAgentDeps = {},
): Promise<ReviewSuggestions> {
  const messages = deps.client ?? new Anthropic().messages;
  const model = deps.model ?? resolveModel();

  const response = await messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: REVIEW_SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: REVIEW_SUGGESTIONS_SCHEMA } },
    messages: [{ role: "user", content: buildReviewUserMessage(input, checks) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Review reasoning was refused by the safety classifier.");
  }
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) {
    throw new Error(`Review reasoning returned no text (stop_reason: ${response.stop_reason}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Review reasoning returned non-JSON output.");
  }
  return ReviewSuggestions.parse(parsed);
}
