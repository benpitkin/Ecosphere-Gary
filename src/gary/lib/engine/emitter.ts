import { EMITTER_SIZING, RADIATOR, meanWaterTempC } from "@/gary/config/decisions";
import type { EmitterStatus } from "@/gary/contracts/survey";

/**
 * Emitter sizing — the first proven primitive of the deterministic spine.
 * =======================================================================
 *
 * Pure functions, no LLM, no I/O. Implements the EN442 radiator output
 * correction (see `RADIATOR` in config) and the per-room sizing decision the
 * engine applies for each option's flow temp at ΔT 5 °C:
 *
 *   - size each room's emitter to 100 % of room demand at the option conditions;
 *   - keep an existing emitter if it already meets demand, else replace it.
 *
 * NOTE: these functions are unit-tested against known EN442 correction factors,
 * but the full engine output is not yet validated against the 3 Orchard Close
 * golden fixture (CLAUDE.md sequencing rule) — model selection (Stelrad
 * catalogue), heat-pump matching and MCS031 are still to come.
 */

/** The radiator-to-room temperature difference at the option's conditions, K. */
export function radiatorDeltaTK(
  flowTempC: number,
  roomTempC: number,
  deltaTC: number = EMITTER_SIZING.deltaTC,
): number {
  return flowTempC - deltaTC / 2 - roomTempC;
}

/** EN442 correction factor for a given radiator Δt (clamped to 0 at/below 0 K). */
export function correctionFactorForDeltaT(deltaTK: number): number {
  if (deltaTK <= 0) return 0;
  return Math.pow(deltaTK / RADIATOR.ratedDeltaTK, RADIATOR.exponent);
}

/** Correction factor at an option's flow temp for a given room temperature. */
export function correctionFactor(flowTempC: number, roomTempC: number): number {
  return correctionFactorForDeltaT(radiatorDeltaTK(flowTempC, roomTempC));
}

/** Actual output of a ΔT50-rated emitter at the option's conditions, watts. */
export function outputAtConditionsW(
  ratedOutputW: number,
  flowTempC: number,
  roomTempC: number,
): number {
  return ratedOutputW * correctionFactor(flowTempC, roomTempC);
}

/**
 * The ΔT50 rated output a radiator must have to meet `roomDemandW` at the
 * option's conditions. Returns Infinity when the conditions can't deliver heat
 * (MWT ≤ room temp); 0 when there is no positive demand.
 */
export function requiredRatedOutputW(
  roomDemandW: number,
  flowTempC: number,
  roomTempC: number,
): number {
  if (roomDemandW <= 0) return 0;
  const f = correctionFactor(flowTempC, roomTempC);
  return f === 0 ? Infinity : roomDemandW / f;
}

export interface EmitterSizingInput {
  roomDemandW: number;
  flowTempC: number;
  roomTempC: number;
  /** ΔT50 rated output of the existing emitter, if one is present. */
  existingRatedOutputW?: number;
}

export interface EmitterSizingResult {
  /** ΔT50 rated output the room needs at these conditions, watts. */
  requiredRatedOutputW: number;
  /** Output that will be provided at these conditions, watts. */
  providedOutputW: number;
  /** Whether the provided output meets 100 % of room demand. */
  meetsDemand: boolean;
  /** New / Keep / Replacement, mirroring Spruce's status model. */
  status: Extract<EmitterStatus, "new" | "keep" | "replacement">;
}

/**
 * Decide a room's emitter for one option: keep the existing emitter if it
 * already meets demand, otherwise specify a replacement (or a new emitter where
 * none exists) sized to 100 % of demand.
 */
export function sizeRoomEmitter(input: EmitterSizingInput): EmitterSizingResult {
  const { roomDemandW, flowTempC, roomTempC, existingRatedOutputW } = input;
  const required = requiredRatedOutputW(roomDemandW, flowTempC, roomTempC);

  if (existingRatedOutputW !== undefined) {
    const existingOutput = outputAtConditionsW(
      existingRatedOutputW,
      flowTempC,
      roomTempC,
    );
    if (existingOutput >= roomDemandW) {
      return {
        requiredRatedOutputW: required,
        providedOutputW: existingOutput,
        meetsDemand: true,
        status: "keep",
      };
    }
    return {
      requiredRatedOutputW: required,
      providedOutputW: Number.isFinite(required) ? roomDemandW : existingOutput,
      meetsDemand: Number.isFinite(required),
      status: "replacement",
    };
  }

  return {
    requiredRatedOutputW: required,
    providedOutputW: Number.isFinite(required) ? roomDemandW : 0,
    meetsDemand: Number.isFinite(required) && roomDemandW > 0 ? true : roomDemandW <= 0,
    status: "new",
  };
}

/** Convenience: mean water temperature for an option (re-exported). */
export { meanWaterTempC };
