import { z } from "zod";

/**
 * SurveyObject — the normalised survey input contract.
 * =====================================================
 *
 * Format-independent representation of a completed heat-loss survey (Spruce PDF
 * today, Spruce API tomorrow). Ingestion adapters produce this; the calc engine
 * consumes it. This is one of the two stable interfaces the whole system depends
 * on — **change only with a version bump** (`SURVEY_OBJECT_VERSION`).
 *
 * Spruce is the source of truth for heat loss: figures here are accepted as-is
 * and are never recalculated by the engine.
 */

export const SURVEY_OBJECT_VERSION = 1 as const;

/** Spruce's per-emitter status model — mirrored, not reinterpreted. */
export const EmitterStatus = z.enum(["new", "keep", "replacement", "remove"]);
export type EmitterStatus = z.infer<typeof EmitterStatus>;

export const EmitterType = z.enum(["radiator", "ufh"]);
export type EmitterType = z.infer<typeof EmitterType>;

/**
 * An existing/surveyed emitter in a room. Radiator rows carry dimensions; UFH
 * rows differ (screed/covering/centres/MWT) — branch on `type`. Output is the
 * surveyed/known output where available; the engine sizes against room demand.
 */
export const SurveyedEmitter = z.object({
  type: EmitterType,
  status: EmitterStatus,
  /** Free-form descriptor as read from the survey (e.g. "Type 22 600x1000"). */
  description: z.string().optional(),
  /** Known/rated output in watts at the survey's stated conditions, if given. */
  outputW: z.number().optional(),
});
export type SurveyedEmitter = z.infer<typeof SurveyedEmitter>;

/**
 * A room from the room-by-room heat loss. Keyed by name + floor because rooms
 * repeat by name (two "Hall/Landing"). Heat loss may be negative for elements
 * facing warmer internal spaces — do not clamp.
 */
export const SurveyRoom = z.object({
  name: z.string(),
  floor: z.string(),
  /** Room design heat loss in watts (accepted from Spruce as-is). */
  heatLossW: z.number(),
  /** Room set-point temperature, °C — drives emitter sizing (flow − ΔT vs room). */
  roomTempC: z.number().optional(),
  /** Floor area m², where reported. */
  floorAreaM2: z.number().optional(),
  /** True when this row represents a merged zone (e.g. "Bed & Ensuite + Bed 1"). */
  merged: z.boolean().default(false),
  emitters: z.array(SurveyedEmitter).default([]),
});
export type SurveyRoom = z.infer<typeof SurveyRoom>;

/** Site design conditions used for sizing. */
export const DesignConditions = z.object({
  /** External design temperature, °C (e.g. -2.2). */
  externalDesignTempC: z.number(),
  /** Internal design temperature, °C (whole-house default, e.g. 21). */
  internalDesignTempC: z.number(),
});
export type DesignConditions = z.infer<typeof DesignConditions>;

export const WholeHouse = z.object({
  /** Whole-house design heat loss in watts (Spruce, e.g. 5650). */
  heatLossW: z.number(),
  /** Total floor area m², if reported. */
  floorAreaM2: z.number().optional(),
});
export type WholeHouse = z.infer<typeof WholeHouse>;

export const Dhw = z.object({
  occupants: z.number().optional(),
  /** Hot water cylinder volume in litres, if specified. */
  cylinderLitres: z.number().optional(),
});
export type Dhw = z.infer<typeof Dhw>;

/** The heat pump recorded on the survey, if one was specified. */
export const SurveyedHeatPump = z.object({
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  /** Nameplate/quoted capacity in kW, if given. */
  ratedCapacityKw: z.number().optional(),
});
export type SurveyedHeatPump = z.infer<typeof SurveyedHeatPump>;

export const SurveyProperty = z.object({
  /** Free-form address / identifier (e.g. "3 Orchard Close, Ottery St. Mary"). */
  address: z.string(),
  propertyType: z.string().optional(),
});
export type SurveyProperty = z.infer<typeof SurveyProperty>;

/**
 * A surfaced issue from ingestion — e.g. an incomplete MCS-required section.
 * Captured, never silently treated as done.
 */
export const SurveyFlag = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "blocker"]).default("warning"),
});
export type SurveyFlag = z.infer<typeof SurveyFlag>;

export const SurveyObject = z.object({
  version: z.literal(SURVEY_OBJECT_VERSION),
  source: z.enum(["pdf", "api"]).default("pdf"),
  property: SurveyProperty,
  designConditions: DesignConditions,
  rooms: z.array(SurveyRoom),
  wholeHouse: WholeHouse,
  dhw: Dhw.optional(),
  heatPump: SurveyedHeatPump.optional(),
  flags: z.array(SurveyFlag).default([]),
});
export type SurveyObject = z.infer<typeof SurveyObject>;

/** Parse + validate untrusted input into a SurveyObject (throws on invalid). */
export function parseSurveyObject(input: unknown): SurveyObject {
  return SurveyObject.parse(input);
}
