import { REASONING } from "@/config/decisions";

/**
 * Active reasoning layer — Phase 0 interface.
 *
 * This defines the contract the rest of Gary will program against. The concrete
 * LLM-backed implementation is wired up in a later phase; Phase 0 ships the
 * types and a resolved configuration so callers can be written now.
 */

export interface ReasoningRequest {
  /** Free-form customer/site context Gary reasons over. */
  readonly context: string;
}

export interface ReasoningResult {
  /** The reasoning layer's structured conclusion (shape TBD per use case). */
  readonly conclusion: unknown;
}

/** Resolves the model the reasoning layer should use. */
export function resolveModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || REASONING.defaultModel;
}

/** Phase 0 placeholder — the LLM call is implemented in a later phase. */
export async function reason(_request: ReasoningRequest): Promise<ReasoningResult> {
  throw new Error("Active reasoning layer not yet implemented (Phase 0 scaffold).");
}
