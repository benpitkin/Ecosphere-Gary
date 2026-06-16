import type { SurveyObject } from "@/contracts/survey";
import type { DesignResult } from "@/contracts/design";

/**
 * Deterministic calc engine — the spine (Phase 3).
 * ================================================
 *
 * Pure, tested TypeScript. **No LLM in the maths.** Given a normalised
 * `SurveyObject`, it produces the three options (40/45/50 °C) each with sized
 * emitters, a matched heat pump, and an MCS031 performance estimate — the
 * `DesignResult`.
 *
 * Phase 0 ships the signature and the documented approach so the rest of the
 * system can be written against it. The implementation lands in Phase 3 and must
 * be validated against the 3 Orchard Close golden fixture before the LLM layer is
 * wired (CLAUDE.md sequencing rule).
 *
 * Approach (per CLAUDE.md):
 *  - For each option, design at its flow temp with ΔT 5 °C (MWT = flow − 2.5).
 *  - Size each room's emitter to 100 % of room demand at those conditions;
 *    keep emitters that already meet demand, otherwise replace/add.
 *  - Match a heat pump whose capacity at design conditions ≥ design heat loss;
 *    read SCOP from its performance table at the option's flow temp.
 *  - Compute the MCS031 estimate per option.
 */

export class NotImplementedError extends Error {
  constructor(phase: string) {
    super(`Not implemented yet — ${phase}.`);
    this.name = "NotImplementedError";
  }
}

export function designOptions(_survey: SurveyObject): DesignResult {
  throw new NotImplementedError("deterministic calc engine (Phase 3)");
}
