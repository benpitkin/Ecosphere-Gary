/**
 * Deterministic calc engine — the spine (Phase 3).
 * ================================================
 *
 * Pure, tested TypeScript. **No LLM in the maths.** Given a normalised
 * `SurveyObject`, it produces the three options (40/45/50 °C) each with sized
 * emitters, a matched heat pump, and an MCS031 performance estimate — the
 * `DesignResult`.
 *
 * The orchestration lives in `designOptions.ts`; the primitives in
 * `emitter.ts` / `heatpump.ts` / `radiator.ts`; manufacturer data under
 * `catalog/`. The two inputs Gary doesn't yet have (the Stelrad catalogue and
 * the MCS031 Issue 4.0 method) are injected dependencies — see `DesignEngineDeps`.
 */

export { designOptions, type DesignEngineDeps } from "@/gary/lib/engine/designOptions";
export {
  provisionalMcs031Calculator,
  type Mcs031Calculator,
  type Mcs031Input,
} from "@/gary/lib/engine/mcs031";

/**
 * Raised by parts of the system that are not built yet (e.g. the Phase 4
 * reasoning layer). The calc engine itself is implemented — kept here because
 * downstream modules still import it.
 */
export class NotImplementedError extends Error {
  constructor(phase: string) {
    super(`Not implemented yet — ${phase}.`);
    this.name = "NotImplementedError";
  }
}
