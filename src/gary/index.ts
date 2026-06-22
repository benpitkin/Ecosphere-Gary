/**
 * Gary — public module surface.
 * =============================
 *
 * Everything under `src/gary/` is the portable engine: pure TypeScript, no
 * framework coupling, configured only through env vars (read explicitly at the
 * edges). This barrel is the single import point for a host app (e.g. Core):
 *
 *   import { designOptions, solarPreDesign, triage, parseSurveyObject } from "@/gary";
 *
 * The Next.js routes/pages under `src/app/` are thin glue — a host re-creates
 * those as its own routes/server actions; they are NOT part of this surface.
 * See `docs/embedding-in-core.md`.
 */

// --- Contracts (versioned interfaces: types + parsers) ---
export * from "@/gary/contracts/survey";
export * from "@/gary/contracts/design";
export * from "@/gary/contracts/triage";
export * from "@/gary/contracts/solar";
export * from "@/gary/contracts/review";
export * from "@/gary/contracts/ask";
// `YesNoUnknown` is defined identically (zod enum) in both the triage and solar
// contracts; an explicit re-export resolves the wildcard ambiguity.
export { YesNoUnknown } from "@/gary/contracts/solar";

// --- Heat-pump design engine (SurveyObject → DesignResult) ---
export {
  designOptions,
  provisionalMcs031Calculator,
  type DesignEngineDeps,
  type Mcs031Calculator,
  type Mcs031Input,
} from "@/gary/lib/engine";

// --- Survey ingestion (Spruce PDF → SurveyObject) ---
export { parseSprucePdf, parseSprucePdfText, extractRoomEmitters } from "@/gary/lib/ingestion/sprucePdf";

// --- Triage (enquiry → next action) ---
export { triage } from "@/gary/lib/triage";

// --- Solar pre-design (SolarEnquiry → SolarPreDesign) ---
export {
  solarPreDesign,
  sizeSolar,
  writeSolarBrief,
  isSolarReasoningConfigured,
  SOLAR_DISCLAIMER,
} from "@/gary/lib/solar";

// --- Design & quote reviewer (ReviewInput → ReviewResult) ---
export {
  reviewDesignQuote,
  runReviewChecks,
  writeReviewSuggestions,
  isReviewReasoningConfigured,
  REVIEW_DISCLAIMER,
} from "@/gary/lib/review";

// --- Ask Gary (technical Q&A: AskInput → AskResult) ---
export {
  askGary,
  isAskConfigured,
  noKnowledgeBase,
  ECOSPHERE_RULES,
  ASK_DISCLAIMER,
  type KnowledgeRetriever,
  type AskDeps,
} from "@/gary/lib/ask";

// --- OpenSolar adapter ---
export {
  createOpenSolarClient,
  isOpenSolarConfigured,
  openSolarConfigFromEnv,
  type OpenSolarClient,
  type OpenSolarConfig,
} from "@/gary/lib/integrations/opensolar";

// --- Inbound API auth (optional glue; only relevant if Gary exposes HTTP itself) ---
export { requireApiKey, isApiAuthEnabled } from "@/gary/lib/apiAuth";

// --- Design rule constants (the encoded EcoSphere rules) ---
export * from "@/gary/config/decisions";
