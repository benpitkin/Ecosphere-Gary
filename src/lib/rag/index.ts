import { NotImplementedError } from "@/lib/engine";

/**
 * Knowledge base — RAG over pgvector (infra in Phase 0, populated in Phase 5).
 * ===========================================================================
 *
 * Grounds the reasoning layer in EcoSphere's derived rules, MCS/CIBSE
 * assumptions, manufacturer data and past design patterns — so it reasons from
 * EcoSphere's rules rather than guessing. The `knowledge_base` table (with a
 * pgvector embedding column) is created empty in Phase 0 by the Supabase
 * migration; retrieval is implemented in Phase 5.
 */

export interface KnowledgeChunk {
  readonly id: string;
  readonly content: string;
  readonly source: string;
  /** Cosine similarity to the query, when returned from a search. */
  readonly score?: number;
}

/** Retrieve the most relevant knowledge chunks for a query (Phase 5). */
export async function retrieve(
  _query: string,
  _limit = 5,
): Promise<KnowledgeChunk[]> {
  throw new NotImplementedError("RAG retrieval over pgvector (Phase 5)");
}
