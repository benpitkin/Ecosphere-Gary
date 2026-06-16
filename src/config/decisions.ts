/**
 * EcoSphere design rules — encoded constants
 * ==========================================
 *
 * Single source of truth for EcoSphere's actual heat-pump design rules (from
 * CLAUDE.md). The deterministic engine encodes these; the LLM layer must never
 * invent or override them. Keeping them here (rather than scattering magic
 * numbers) keeps the engine honest as it grows.
 */

import type { OptionKey } from "@/contracts/design";

/**
 * The three-option framework — the heart of the product.
 *
 * Always three options, always these flow temps, no per-property variation.
 * 45 °C is the established sweet spot and the default starting point.
 */
export const OPTIONS = [
  { key: "eco", flowTempC: 40, capitalRank: "highest", radiators: "largest" },
  { key: "sweet_spot", flowTempC: 45, capitalRank: "medium", radiators: "medium" },
  { key: "budget", flowTempC: 50, capitalRank: "lowest", radiators: "smallest" },
] as const satisfies ReadonlyArray<{
  key: OptionKey;
  flowTempC: 40 | 45 | 50;
  capitalRank: "highest" | "medium" | "lowest";
  radiators: string;
}>;

/** Exactly three options are always produced. */
export const OPTION_COUNT = OPTIONS.length; // 3

/** The fixed flow temperatures, in option order. */
export const FLOW_TEMPS_C = [40, 45, 50] as const;

/** The default / recommended option. */
export const DEFAULT_OPTION: OptionKey = "sweet_spot";

/**
 * Emitter sizing rule: design at the option's flow temp with ΔT 5 °C, so the
 * mean water temperature is `flow − deltaT/2`. Engine sizes to 100 % of room
 * demand at those conditions.
 */
export const EMITTER_SIZING = {
  deltaTC: 5,
  /** Fraction of room demand each emitter must meet (100 %). */
  demandCoverage: 1.0,
} as const;

/** Mean water temperature for an option's flow temp at the standard ΔT. */
export function meanWaterTempC(flowTempC: number): number {
  return flowTempC - EMITTER_SIZING.deltaTC / 2;
}

/** Heat-pump matching: capacity at design conditions must meet/exceed loss. */
export const HEAT_PUMP_MATCH = {
  /** Minimum acceptable cover (capacity / design heat loss). */
  minCoverRatio: 1.0,
  /** Above this, flag as implausibly oversized for designer review. */
  oversizeFlagRatio: 2.0,
} as const;

/** EcoSphere technical defaults (the "standard" kit). */
export const TECHNICAL_DEFAULTS = {
  heatPumps: ["Vaillant aroTHERM", "Grant"],
  radiators: "Stelrad",
  pipework: ["copper", "MLCP"],
  primaryRunMetres: 10,
} as const;

/**
 * Ownership boundary: Gary owns the **design** (emitter/kit quantities and the
 * three options); EcoSphere **Core** owns **pricing**. Gary never hard-codes or
 * persists prices — Core attaches them when building the proposal.
 */
export const OWNERSHIP = {
  design: "gary" as const,
  prices: "core" as const,
} as const;

/**
 * Active reasoning layer (Claude). Reactive/observational: it monitors customer
 * comms, reads intent, and writes per-option justifications around the
 * deterministic maths — it never runs the maths. Model defaults to the latest,
 * most capable model and is overridable via `ANTHROPIC_MODEL`.
 */
export const REASONING = {
  mode: "reactive-observational" as const,
  defaultModel: "claude-opus-4-8",
} as const;
