import { HEAT_PUMP_MATCH } from "@/config/decisions";

/**
 * Heat-pump matching — deterministic spine primitive.
 * ===================================================
 *
 * Pure functions, no I/O. Matches a heat pump to a design heat loss at an
 * option's flow temp:
 *   - capacity at design conditions must be ≥ design heat loss (cover ≥ 100 %);
 *   - SCOP is read from the model's performance table at the option's flow temp
 *     (so each of the three options carries a different SCOP);
 *   - flag if cover is under 100 % or implausibly oversized.
 *
 * The real manufacturer catalogue (Vaillant aroTHERM / Grant) is supplied by the
 * caller as `HeatPumpModel[]` — its numbers come from manufacturer data, not from
 * this module. The matching logic here is unit-tested, including against the
 * 3 Orchard Close fixture's stated figures (5.65 kW loss, 7.54 kW capacity →
 * 1.33 cover, SCOP 4.13 @ 45 °C).
 */

export interface HeatPumpPerformancePoint {
  flowTempC: 40 | 45 | 50;
  /** Heating capacity at the site design ambient and this flow temp, kW. */
  capacityKw: number;
  /** SCOP at this flow temp. */
  scop: number;
}

export interface HeatPumpModel {
  manufacturer: string;
  model: string;
  /** One point per modelled flow temp at the site design ambient. */
  performance: HeatPumpPerformancePoint[];
}

export interface MatchFlag {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocker";
}

export interface HeatPumpMatch {
  manufacturer: string;
  model: string;
  flowTempC: 40 | 45 | 50;
  capacityAtDesignKw: number;
  scop: number;
  /** capacityAtDesign / design heat loss. */
  coverRatio: number;
  flags: MatchFlag[];
}

/**
 * Evaluate one model at one flow temp. Returns null when the model has no
 * performance point for that flow temp (can't be assessed).
 */
export function matchHeatPump(
  designHeatLossKw: number,
  flowTempC: 40 | 45 | 50,
  model: HeatPumpModel,
): HeatPumpMatch | null {
  const point = model.performance.find((p) => p.flowTempC === flowTempC);
  if (!point) return null;
  if (designHeatLossKw <= 0) return null;

  const coverRatio = point.capacityKw / designHeatLossKw;
  const flags: MatchFlag[] = [];
  if (coverRatio < HEAT_PUMP_MATCH.minCoverRatio) {
    flags.push({
      code: "heat_pump_undersized",
      message: `Capacity ${point.capacityKw} kW only covers ${(coverRatio * 100).toFixed(0)} % of the ${designHeatLossKw} kW design heat loss.`,
      severity: "blocker",
    });
  } else if (coverRatio > HEAT_PUMP_MATCH.oversizeFlagRatio) {
    flags.push({
      code: "heat_pump_oversized",
      message: `Capacity ${point.capacityKw} kW is ${(coverRatio * 100).toFixed(0)} % of the design heat loss — check for short-cycling.`,
      severity: "warning",
    });
  }

  return {
    manufacturer: model.manufacturer,
    model: model.model,
    flowTempC,
    capacityAtDesignKw: point.capacityKw,
    scop: point.scop,
    coverRatio,
    flags,
  };
}

/**
 * Select the best-fitting heat pump from candidates for one option.
 *
 * Preference order:
 *  1. smallest capacity whose cover is within [minCover, oversize] (tightest
 *     adequate sizing without short-cycling risk);
 *  2. otherwise smallest capacity meeting minCover (oversized, flagged);
 *  3. otherwise the highest-cover candidate (undersized, flagged) so the
 *     designer sees the closest miss.
 *
 * Returns null only when no candidate has a performance point at this flow temp.
 */
export function selectHeatPump(
  designHeatLossKw: number,
  flowTempC: 40 | 45 | 50,
  candidates: HeatPumpModel[],
): HeatPumpMatch | null {
  const matches = candidates
    .map((m) => matchHeatPump(designHeatLossKw, flowTempC, m))
    .filter((m): m is HeatPumpMatch => m !== null);
  if (matches.length === 0) return null;

  const adequate = matches.filter(
    (m) => m.coverRatio >= HEAT_PUMP_MATCH.minCoverRatio,
  );
  if (adequate.length > 0) {
    const inRange = adequate.filter(
      (m) => m.coverRatio <= HEAT_PUMP_MATCH.oversizeFlagRatio,
    );
    const pool = inRange.length > 0 ? inRange : adequate;
    return pool.reduce((best, m) =>
      m.capacityAtDesignKw < best.capacityAtDesignKw ? m : best,
    );
  }

  // Nothing meets cover — surface the closest (highest cover).
  return matches.reduce((best, m) => (m.coverRatio > best.coverRatio ? m : best));
}
