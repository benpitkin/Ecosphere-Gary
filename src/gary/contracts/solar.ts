import { z } from "zod";

/**
 * Solar pre-design contracts (EcoSphere Solar Pre-Design Agent).
 * =============================================================
 *
 * Gary's solar side sits **upstream of OpenSolar**: it turns a raw enquiry into a
 * structured, sales-ready pre-design brief that Ben/Natasha review before
 * committing time to a full OpenSolar design. Three versioned objects:
 *
 *  - `SolarEnquiry`   — the (messy, mostly-optional) input.
 *  - `SolarSizing`    — the **deterministic** engine output (kWp, generation,
 *                       battery, DNO/G99 threshold). Auditable; no LLM.
 *  - `SolarPreDesign` — the final brief: the sizing + the Claude-written
 *                       narrative (`SolarBrief`), with an indicative-not-a-quote
 *                       disclaimer.
 *
 * Everything here is **indicative pre-survey**, never a quote.
 */

export const SOLAR_CONTRACT_VERSION = 1 as const;

export const Orientation = z.enum(["S", "SE", "SW", "E", "W", "NE", "NW", "N", "unknown"]);
export type Orientation = z.infer<typeof Orientation>;

export const Phase = z.enum(["single", "three", "unknown"]);
export type Phase = z.infer<typeof Phase>;

export const Shading = z.enum(["none", "light", "moderate", "heavy", "unknown"]);
export type Shading = z.infer<typeof Shading>;

export const YesNoUnknown = z.enum(["yes", "no", "unknown"]);
export type YesNoUnknown = z.infer<typeof YesNoUnknown>;

/** A flag for the human reviewer (mirrors the survey/design flag shape). */
export const SolarFlag = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "blocker"]).default("warning"),
});
export type SolarFlag = z.infer<typeof SolarFlag>;

/** One usable roof plane. All optional — the agent infers what it can. */
export const RoofFace = z.object({
  orientation: Orientation.default("unknown"),
  /** Roof pitch in degrees from horizontal (0 = flat). */
  pitchDeg: z.number().optional(),
  /** Usable area for panels, m². */
  areaM2: z.number().optional(),
  shading: Shading.default("unknown"),
  note: z.string().optional(),
});
export type RoofFace = z.infer<typeof RoofFace>;

export const SolarEnquiry = z.object({
  version: z.literal(SOLAR_CONTRACT_VERSION).default(SOLAR_CONTRACT_VERSION),
  address: z.string(),
  /** Known annual electricity use, kWh (from a bill / half-hourly data). */
  annualConsumptionKwh: z.number().optional(),
  occupants: z.number().optional(),
  bedrooms: z.number().optional(),
  hasEv: z.boolean().optional(),
  hasHeatPump: z.boolean().optional(),
  /** Mains supply phase — drives the DNO G98/G99 per-phase threshold. */
  phase: Phase.default("unknown"),
  roofFaces: z.array(RoofFace).default([]),
  /** Free-text customer goals (the agent reads intent from this). */
  goals: z.string().optional(),
  wantsBattery: z.boolean().optional(),
  listedOrConservation: YesNoUnknown.default("unknown"),
  /** Free-text catch-all for anything else from the enquiry. */
  notes: z.string().optional(),
});
export type SolarEnquiry = z.infer<typeof SolarEnquiry>;

export function parseSolarEnquiry(input: unknown): SolarEnquiry {
  return SolarEnquiry.parse(input);
}

/** Deterministic DNO connection assessment. */
export const DnoAssessment = z.object({
  /** G98 = notify after install (≤ limit); G99 = prior approval (> limit). */
  application: z.enum(["g98_notify", "g99_approval"]),
  /** Per-phase inverter export limit before G99 is triggered, kW (3.68). */
  perPhaseLimitKw: z.number(),
  /** True when the proposed inverter exceeds the limit (G99 approval needed). */
  g99Required: z.boolean(),
});
export type DnoAssessment = z.infer<typeof DnoAssessment>;

/**
 * The deterministic sizing estimate — the spine. Indicative pre-survey.
 */
export const SolarSizing = z.object({
  recommendedKwp: z.number(),
  panelCount: z.number(),
  panelWatt: z.number(),
  /** Indicative inverter AC size, kW (drives the DNO threshold). */
  inverterKw: z.number(),
  /** Recommended battery capacity, kWh; null when none is recommended. */
  batteryKwh: z.number().nullable(),
  estimatedAnnualGenerationKwh: z.number(),
  /** Specific yield used, kWh per kWp per year (after orientation/pitch/shade). */
  specificYieldKwhPerKwp: z.number(),
  /** Indicative self-consumption (share of generation used on-site), %. */
  selfConsumptionPct: z.number(),
  estimatedAnnualConsumptionKwh: z.number(),
  /** Generation ÷ consumption, %. */
  consumptionOffsetPct: z.number(),
  sizingBasis: z.enum(["usage", "roof_area", "occupancy", "default"]),
  dno: DnoAssessment,
  flags: z.array(SolarFlag),
  assumptions: z.array(z.string()),
});
export type SolarSizing = z.infer<typeof SolarSizing>;

/**
 * The narrative brief written by the Claude reasoning layer around the
 * deterministic sizing. Prose for Ben/Natasha; never invents the numbers.
 */
export const SolarBrief = z.object({
  siteSummary: z.string(),
  systemRationale: z.string(),
  generationNote: z.string(),
  constraintsAndFlags: z.array(z.string()),
  openQuestionsForSurvey: z.array(z.string()),
  recommendedNextStep: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string()),
});
export type SolarBrief = z.infer<typeof SolarBrief>;

export const SolarPreDesign = z.object({
  version: z.literal(SOLAR_CONTRACT_VERSION),
  address: z.string(),
  sizing: SolarSizing,
  /** Null when the reasoning layer isn't configured (no ANTHROPIC_API_KEY). */
  brief: SolarBrief.nullable(),
  disclaimer: z.string(),
});
export type SolarPreDesign = z.infer<typeof SolarPreDesign>;

export function parseSolarPreDesign(input: unknown): SolarPreDesign {
  return SolarPreDesign.parse(input);
}
