import type { Mcs031 } from "@/contracts/design";

/**
 * MCS031 performance estimate — the per-option energy/cost/carbon figure.
 * ======================================================================
 *
 * The engine treats MCS031 as an **injected dependency**: `designOptions` asks a
 * `Mcs031Calculator` for each option's estimate. This is deliberate — the real
 * *MCS 031 Issue 4.0* method (fixed-SPF tables by flow temp/emitter, the HDD
 * demand calculation) and the tariff/carbon factors are compliance-critical and
 * **not yet available to encode** (blocked on Ben). When they arrive they slot
 * in as a new `Mcs031Calculator` with `compliant: true`; nothing else changes.
 *
 * Until then `provisionalMcs031Calculator` produces a transparent, clearly
 * non-compliant placeholder so the pipeline runs end-to-end. Every result built
 * with it carries a blocker review flag (see `designOptions`) — it must never be
 * mistaken for an auditable figure.
 */

export interface Mcs031Input {
  flowTempC: 40 | 45 | 50;
  /** Heating SCOP at this flow temp (from the heat pump performance table). */
  scop: number;
  /** Whole-house design heat loss, kW. */
  designHeatLossKw: number;
  floorAreaM2?: number;
  /** DHW occupants, where known. */
  dhwOccupants?: number;
}

export interface Mcs031Calculator {
  /** Method identifier, e.g. "MCS031:4.0" or "provisional-v0". */
  readonly method: string;
  /** True only when backed by the real MCS031 method + tariff/carbon factors. */
  readonly compliant: boolean;
  compute(input: Mcs031Input): Mcs031;
}

/**
 * PROVISIONAL placeholder factors — NOT the MCS031 method. Each is a transparent
 * proxy chosen only so the pipeline produces plausible, non-zero numbers; all
 * are flagged at the result level and must be replaced by Ben's real data.
 */
export const PROVISIONAL_FACTORS = {
  /** Equivalent full-load hours proxy (real method uses HDD/degree-days). */
  equivalentFullLoadHours: 2100,
  /** Annual DHW heat demand per occupant, kWh (proxy for the MCS031 DHW calc). */
  dhwKwhPerOccupant: 730,
  /** Assumed occupants when the survey doesn't state DHW occupancy. */
  defaultOccupants: 3,
  /** DHW is delivered at a lower COP than space heating — proxy derating. */
  dhwCopFraction: 0.6,
  /** Placeholder electricity tariff, £/kWh. */
  tariffGbpPerKwh: 0.27,
  /** Placeholder grid carbon intensity, kgCO2e/kWh. */
  carbonKgPerKwh: 0.207,
} as const;

const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/**
 * A transparent placeholder calculator. Space-heating demand is a simple
 * EFLH × capacity proxy; DHW is a per-occupant proxy; SPF is blended across
 * heating (at SCOP) and DHW (at a derated COP) so it still varies per option;
 * cost and carbon come from the resulting electricity input. Clearly labelled
 * `compliant: false`.
 */
export const provisionalMcs031Calculator: Mcs031Calculator = {
  method: "provisional-v0",
  compliant: false,
  compute({ scop, designHeatLossKw, dhwOccupants }): Mcs031 {
    const f = PROVISIONAL_FACTORS;
    const occupants = dhwOccupants ?? f.defaultOccupants;

    // Delivered (thermal) demand — reported as heating/DHW kWh, matching the way
    // the report states them (12,165 heating / 2,938 DHW for this fixture).
    const annualHeatingKwh = designHeatLossKw * f.equivalentFullLoadHours;
    const annualDhwKwh = occupants * f.dhwKwhPerOccupant;

    // Guard against a non-positive SCOP (e.g. the engine's heat-pump "no match"
    // fallback passes scop 0): dividing would yield Infinity/NaN, which would
    // either masquerade as a real figure or crash result validation. Report the
    // demand but zero the electricity-derived figures — the no-match heat pump
    // already raises its own blocker flag.
    if (!(scop > 0)) {
      return {
        spf: 0,
        annualHeatingKwh: round(annualHeatingKwh),
        annualDhwKwh: round(annualDhwKwh),
        annualRunningCostGbp: 0,
        annualCarbonKgCo2e: 0,
      };
    }

    // Electricity input — heating at SCOP, DHW at a derated COP.
    const dhwCop = scop * f.dhwCopFraction;
    const electricityKwh = annualHeatingKwh / scop + annualDhwKwh / dhwCop;
    const spf = (annualHeatingKwh + annualDhwKwh) / electricityKwh;

    return {
      spf: round(spf, 2),
      annualHeatingKwh: round(annualHeatingKwh),
      annualDhwKwh: round(annualDhwKwh),
      annualRunningCostGbp: round(electricityKwh * f.tariffGbpPerKwh, 2),
      annualCarbonKgCo2e: round(electricityKwh * f.carbonKgPerKwh),
    };
  },
};
