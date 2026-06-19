import { z } from "zod";

/**
 * Triage contracts (front-of-funnel, pre-survey).
 * ===============================================
 *
 * Triage runs BEFORE a Spruce survey exists — from an address plus a few
 * qualifying answers (typed in by staff during/after a call, or later pulled
 * from EPC data). It is deliberately separate from the design engine, which
 * needs a completed heat loss. Output is a recommended next action, an
 * *indicative* heat-pump size band, and the flags that drove the judgement.
 *
 * Versioned like the other contracts — change only with a version bump.
 */

export const TRIAGE_VERSION = 1 as const;

export const WallType = z.enum([
  "cavity_filled",
  "cavity_unfilled",
  "solid",
  "timber",
  "unknown",
]);
export type WallType = z.infer<typeof WallType>;

export const Glazing = z.enum(["double", "single", "mixed", "unknown"]);
export type Glazing = z.infer<typeof Glazing>;

export const MainFuel = z.enum([
  "mains_gas",
  "oil",
  "lpg",
  "electric",
  "other",
  "unknown",
]);
export type MainFuel = z.infer<typeof MainFuel>;

export const YesNoUnknown = z.enum(["yes", "no", "unknown"]);
export type YesNoUnknown = z.infer<typeof YesNoUnknown>;

/** Property characteristics — from EPC or entered manually. All optional. */
export const TriageProperty = z.object({
  floorAreaM2: z.number().positive().optional(),
  propertyType: z.string().optional(),
  ageBand: z.enum(["pre_1950", "1950_2000", "post_2000", "unknown"]).optional(),
  wallType: WallType.optional(),
  glazing: Glazing.optional(),
  mainFuel: MainFuel.optional(),
  epcRating: z.string().optional(),
});
export type TriageProperty = z.infer<typeof TriageProperty>;

/** Qualifying answers captured on the call. */
export const TriageAnswers = z.object({
  ownerOccupier: YesNoUnknown.default("unknown"),
  listedOrConservation: YesNoUnknown.default("unknown"),
  spaceForUnitAndCylinder: YesNoUnknown.default("unknown"),
});
export type TriageAnswers = z.infer<typeof TriageAnswers>;

export const TriageInput = z.object({
  version: z.literal(TRIAGE_VERSION).default(TRIAGE_VERSION),
  address: z.string().min(1),
  property: TriageProperty.default({}),
  answers: TriageAnswers.default({}),
  notes: z.string().optional(),
});
export type TriageInput = z.infer<typeof TriageInput>;

export const NextAction = z.enum([
  "book_survey",
  "human_follow_up",
  "gather_info",
  "nurture",
  "not_suitable",
]);
export type NextAction = z.infer<typeof NextAction>;

export const Suitability = z.enum([
  "good",
  "promising_complex",
  "unclear",
  "unlikely",
]);
export type Suitability = z.infer<typeof Suitability>;

export const TriageFlag = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "blocker"]).default("info"),
});
export type TriageFlag = z.infer<typeof TriageFlag>;

/** An inclusive numeric range, e.g. an indicative kW band. */
export const Band = z.object({ low: z.number(), high: z.number() });
export type Band = z.infer<typeof Band>;

export const TriageResult = z.object({
  version: z.literal(TRIAGE_VERSION),
  nextAction: NextAction,
  suitability: Suitability,
  /** Indicative whole-house heat loss, kW (pre-survey estimate, not MCS). */
  indicativeHeatLossKw: Band.nullable(),
  /** Indicative heat-pump size band, kW. */
  indicativeHeatPumpKw: Band.nullable(),
  /** Smallest sensible nominal HP size that covers the estimate, kW. */
  suggestedNominalKw: z.number().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  flags: z.array(TriageFlag),
  /** Plain-English audit of what drove the judgement. */
  basis: z.array(z.string()),
});
export type TriageResult = z.infer<typeof TriageResult>;

export function parseTriageInput(input: unknown): TriageInput {
  return TriageInput.parse(input);
}
