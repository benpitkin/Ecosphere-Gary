import {
  SOLAR_CONTRACT_VERSION,
  type SolarBrief,
  type SolarEnquiry,
  type SolarPreDesign,
} from "@/contracts/solar";
import { sizeSolar } from "@/lib/solar/sizing";
import { isSolarReasoningConfigured, writeSolarBrief, type SolarAgentDeps } from "@/lib/solar/agent";

/**
 * Solar pre-design orchestrator (EcoSphere Solar Pre-Design Agent).
 * ================================================================
 *
 * `SolarEnquiry` → `SolarPreDesign`. Always runs the deterministic sizing; adds
 * the Claude-written brief when the reasoning layer is configured
 * (`ANTHROPIC_API_KEY`). Output is always **indicative pre-survey, never a
 * quote** — sits upstream of OpenSolar for Ben/Natasha to review.
 */

export const SOLAR_DISCLAIMER =
  "Indicative pre-survey estimate only — not a quote. Figures assume UK / South-West conditions and must be confirmed by a site survey and a full OpenSolar design before any offer is made.";

export interface SolarPreDesignDeps extends SolarAgentDeps {
  /** Force-skip the reasoning layer (e.g. fast path); defaults to env gating. */
  skipBrief?: boolean;
}

export async function solarPreDesign(
  enquiry: SolarEnquiry,
  deps: SolarPreDesignDeps = {},
): Promise<SolarPreDesign> {
  const sizing = sizeSolar(enquiry);

  let brief: SolarBrief | null = null;
  const useReasoning = !deps.skipBrief && (deps.client !== undefined || isSolarReasoningConfigured());
  if (useReasoning) {
    brief = await writeSolarBrief(enquiry, sizing, deps);
  }

  return {
    version: SOLAR_CONTRACT_VERSION,
    address: enquiry.address,
    sizing,
    brief,
    disclaimer: SOLAR_DISCLAIMER,
  };
}

export { sizeSolar } from "@/lib/solar/sizing";
export { isSolarReasoningConfigured, writeSolarBrief } from "@/lib/solar/agent";
