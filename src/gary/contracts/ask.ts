import { z } from "zod";

/**
 * Ask-Gary contracts (technical Q&A).
 * ===================================
 *
 * Lets Ben ask Gary technical questions — heat-pump design, emitter sizing, MCS
 * rules, EcoSphere standards. The answer is written by Claude, grounded in
 * EcoSphere's own design rules (always) and the RAG knowledge base (when
 * populated, Phase 5). It is an internal technical aid, not a customer-facing
 * chatbot and not a compliance sign-off. Versioned interface.
 */

export const ASK_CONTRACT_VERSION = 1 as const;

export const AskTurn = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type AskTurn = z.infer<typeof AskTurn>;

export const AskInput = z.object({
  version: z.literal(ASK_CONTRACT_VERSION).default(ASK_CONTRACT_VERSION),
  question: z.string().min(1, "A question is required."),
  /** Prior turns, oldest first, for multi-turn follow-ups. */
  history: z.array(AskTurn).default([]),
  /** Optional pasted context (e.g. a design summary or survey figures) to ground the answer. */
  jobContext: z.string().optional(),
});
export type AskInput = z.infer<typeof AskInput>;

export function parseAskInput(input: unknown): AskInput {
  return AskInput.parse(input);
}

export const AskCitation = z.object({
  source: z.string(),
  snippet: z.string().optional(),
});
export type AskCitation = z.infer<typeof AskCitation>;

export const AskResult = z.object({
  version: z.literal(ASK_CONTRACT_VERSION),
  /** The answer, in markdown. */
  answer: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  /** Knowledge-base passages the answer drew on (empty until Phase 5 populates the KB). */
  citations: z.array(AskCitation),
  /** Whether any knowledge-base passages were retrieved and used. */
  usedKnowledgeBase: z.boolean(),
  disclaimer: z.string(),
});
export type AskResult = z.infer<typeof AskResult>;

export function parseAskResult(input: unknown): AskResult {
  return AskResult.parse(input);
}
