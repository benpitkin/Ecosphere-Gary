import { z } from "zod";

/**
 * Design & quote review contracts.
 * ================================
 *
 * Gary's reviewer capability: "assess my designs and quotes, suggest
 * improvements." It takes a normalised heat-pump **design + quote** (whatever Ben
 * built by hand in Core, mapped to this shape by a Core-side adapter) and returns
 * deterministic **findings** plus Claude-written **suggestions**.
 *
 * Like the rest of Gary: the checks are pure and auditable (no LLM in the
 * verdict); the LLM only phrases improvements around them. Versioned interface —
 * change only with a version bump.
 */

export const REVIEW_CONTRACT_VERSION = 1 as const;

export const ReviewEmitter = z.object({
  type: z.enum(["radiator", "ufh", "other"]).default("radiator"),
  status: z.enum(["new", "keep", "replacement", "remove"]).optional(),
  specification: z.string().optional(),
  /** Output at the design flow temp / ΔT, watts (what a design/survey states). */
  outputW: z.number().optional(),
  /** Alternatively, the ΔT50 rated output — converted to conditions if flow temp is known. */
  ratedOutputW50: z.number().optional(),
});
export type ReviewEmitter = z.infer<typeof ReviewEmitter>;

export const ReviewRoom = z.object({
  name: z.string(),
  heatLossW: z.number(),
  roomTempC: z.number().optional(),
  emitters: z.array(ReviewEmitter).default([]),
});
export type ReviewRoom = z.infer<typeof ReviewRoom>;

export const ReviewHeatPump = z.object({
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  /** Heating capacity at the site design condition, kW. */
  capacityAtDesignKw: z.number().optional(),
  scop: z.number().optional(),
});
export type ReviewHeatPump = z.infer<typeof ReviewHeatPump>;

export const ReviewDesign = z.object({
  wholeHouseHeatLossKw: z.number(),
  flowTempC: z.number().optional(),
  deltaTC: z.number().default(5),
  designOutsideTempC: z.number().optional(),
  heatPump: ReviewHeatPump.default({}),
  rooms: z.array(ReviewRoom).default([]),
  /** Whether a full MCS031 performance estimate is attached (MCS-required). */
  mcs031Present: z.boolean().default(false),
  /** Whether the design includes a DHW cylinder (drives a quote-coverage check). */
  hasDhw: z.boolean().default(false),
});
export type ReviewDesign = z.infer<typeof ReviewDesign>;

export const QuoteLine = z.object({
  description: z.string(),
  /** Optional explicit category; otherwise inferred from the description. */
  category: z
    .enum(["heat_pump", "cylinder", "radiator", "pipework", "labour", "sundries", "other"])
    .optional(),
  quantity: z.number().optional(),
  unitPriceGbp: z.number().optional(),
  totalGbp: z.number().optional(),
});
export type QuoteLine = z.infer<typeof QuoteLine>;

export const ReviewQuote = z.object({
  lineItems: z.array(QuoteLine).default([]),
  totalGbp: z.number().optional(),
});
export type ReviewQuote = z.infer<typeof ReviewQuote>;

export const ReviewInput = z.object({
  version: z.literal(REVIEW_CONTRACT_VERSION).default(REVIEW_CONTRACT_VERSION),
  design: ReviewDesign,
  quote: ReviewQuote.optional(),
});
export type ReviewInput = z.infer<typeof ReviewInput>;

export function parseReviewInput(input: unknown): ReviewInput {
  return ReviewInput.parse(input);
}

/** A deterministic finding from the checks (mirrors the flag shape used elsewhere). */
export const ReviewFinding = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "blocker"]).default("warning"),
});
export type ReviewFinding = z.infer<typeof ReviewFinding>;

/** Deterministic, auditable numbers the review computed. */
export const ReviewMetrics = z.object({
  coverRatio: z.number().nullable(),
  roomsChecked: z.number(),
  roomsUndersized: z.number(),
});
export type ReviewMetrics = z.infer<typeof ReviewMetrics>;

/** Claude-written narrative; null when the reasoning layer isn't configured. */
export const ReviewSuggestions = z.object({
  summary: z.string(),
  suggestions: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
});
export type ReviewSuggestions = z.infer<typeof ReviewSuggestions>;

export const ReviewResult = z.object({
  version: z.literal(REVIEW_CONTRACT_VERSION),
  /** Overall verdict from the deterministic findings. */
  verdict: z.enum(["pass", "review", "fail"]),
  findings: z.array(ReviewFinding),
  metrics: ReviewMetrics,
  suggestions: ReviewSuggestions.nullable(),
  disclaimer: z.string(),
});
export type ReviewResult = z.infer<typeof ReviewResult>;

export function parseReviewResult(input: unknown): ReviewResult {
  return ReviewResult.parse(input);
}
