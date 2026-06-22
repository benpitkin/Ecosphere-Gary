import {
  ASK_CONTRACT_VERSION,
  type AskCitation,
  type AskInput,
  type AskResult,
} from "@/gary/contracts/ask";
import type { KnowledgeChunk } from "@/gary/lib/rag";
import { answerQuestion, isAskConfigured, type AskAgentDeps } from "@/gary/lib/ask/agent";

/**
 * Ask-Gary orchestrator.
 * ======================
 *
 * `AskInput` → `AskResult`. Retrieves relevant knowledge-base passages (via an
 * injectable retriever; none by default until Phase 5), then has the Claude layer
 * answer the question grounded in EcoSphere's rules + those passages. An internal
 * technical aid — advisory, never a compliance sign-off.
 */

export const ASK_DISCLAIMER =
  "Gary's answers are an internal technical aid grounded in EcoSphere's design rules — advisory only. They support Ben's judgement and do not replace his sign-off or an MCS audit. Provisional figures (e.g. MCS031 running costs) are flagged as such.";

/** Retrieves the most relevant knowledge-base passages for a query. */
export type KnowledgeRetriever = (query: string, limit?: number) => Promise<KnowledgeChunk[]>;

/** Default retriever: the knowledge base is empty until Phase 5, so nothing is returned. */
export const noKnowledgeBase: KnowledgeRetriever = async () => [];

export interface AskDeps extends AskAgentDeps {
  /** Knowledge-base retriever; defaults to the empty KB (Phase 5 injects a real one). */
  retrieve?: KnowledgeRetriever;
  /** Max passages to retrieve. */
  limit?: number;
}

export async function askGary(input: AskInput, deps: AskDeps = {}): Promise<AskResult> {
  if (!deps.client && !isAskConfigured()) {
    throw new Error(
      "Ask-Gary is Claude-powered and needs ANTHROPIC_API_KEY set. See docs/embedding-in-core.md.",
    );
  }

  const retrieve = deps.retrieve ?? noKnowledgeBase;
  const passages = await retrieve(input.question, deps.limit ?? 5);

  const { answer, confidence, citedSources } = await answerQuestion(input, passages, deps);

  // Build citations from the sources the model actually cited, attaching a snippet
  // from the retrieved passage where we have one.
  const citations: AskCitation[] = [];
  const seen = new Set<string>();
  for (const source of citedSources) {
    if (seen.has(source)) continue;
    seen.add(source);
    const match = passages.find((p) => p.source === source);
    citations.push(match ? { source, snippet: match.content.slice(0, 240) } : { source });
  }

  return {
    version: ASK_CONTRACT_VERSION,
    answer,
    confidence,
    citations,
    usedKnowledgeBase: citations.length > 0,
    disclaimer: ASK_DISCLAIMER,
  };
}

export { answerQuestion, isAskConfigured } from "@/gary/lib/ask/agent";
export { ECOSPHERE_RULES } from "@/gary/lib/ask/grounding";
