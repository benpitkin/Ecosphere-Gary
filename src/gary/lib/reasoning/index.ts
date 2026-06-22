import { REASONING } from "@/gary/config/decisions";
import { NotImplementedError } from "@/gary/lib/engine";
import type { DesignOption } from "@/gary/contracts/design";

/**
 * Claude reasoning layer — the brain around the maths (Phase 4).
 * =============================================================
 *
 * Reactive and observational. It monitors customer comms (emails, call
 * transcripts, notes), reads intent, and writes the per-option justification in
 * light of what the customer actually said. It does **not** run or steer the
 * conversation, and it never runs or overrides the deterministic maths — it
 * listens and explains. It grounds itself via the RAG knowledge base.
 *
 * Phase 0 ships the contract + resolved model config. Wired up in Phase 4, after
 * the calc engine is proven.
 */

export interface CustomerIntent {
  /** Distilled signals from customer comms (price-sensitivity, eco-priority…). */
  readonly summary: string;
}

/** Resolves the model the reasoning layer should use. */
export function resolveModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || REASONING.defaultModel;
}

/** Writes a per-option justification informed by customer intent (Phase 4). */
export async function writeJustification(
  _option: DesignOption,
  _intent: CustomerIntent,
): Promise<string> {
  throw new NotImplementedError("Claude reasoning layer (Phase 4)");
}
