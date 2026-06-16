import type { DesignResult } from "@/contracts/design";
import { NotImplementedError } from "@/lib/engine";

/**
 * Core integration — hand off the three options (Phase 6).
 * ========================================================
 *
 * Gary owns the design; EcoSphere **Core** owns pricing. Once Ben checks the
 * options and locks one in, Core attaches pricing and builds the customer
 * proposal. This module hands a `DesignResult` to Core over HTTPS; Gary never
 * prices anything itself.
 *
 * Phase 0 ships the contract + config check. Implemented in Phase 6.
 */

export function isCoreConfigured(): boolean {
  return Boolean(process.env.CORE_API_BASE_URL && process.env.CORE_API_KEY);
}

export async function handOffToCore(_result: DesignResult): Promise<void> {
  throw new NotImplementedError("Core hand-off (Phase 6)");
}
