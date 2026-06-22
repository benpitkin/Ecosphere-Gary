/**
 * Radiator selection — deterministic spine primitive.
 * ===================================================
 *
 * Turns a required ΔT50 rated output (from `emitter.ts`) into a concrete
 * radiator specification by choosing from a caller-supplied catalogue (Stelrad
 * is the EcoSphere standard). Pure, tested. The catalogue's numbers come from
 * the manufacturer's data, not this module.
 *
 * Selection rule: the smallest catalogue radiator whose ΔT50 rated output meets
 * the requirement; if none is large enough, the largest available (flagged by
 * the caller via the returned `meetsRequirement`).
 */

export interface RadiatorModel {
  /** Catalogue label, e.g. "Stelrad Compact Type 22 600x1200". */
  specification: string;
  /** Rated output at the EN442 reference Δt of 50 K, watts. */
  ratedOutputW: number;
}

export interface RadiatorSelection {
  specification: string;
  ratedOutputW: number;
  meetsRequirement: boolean;
}

/**
 * Choose a radiator for a required ΔT50 output from `catalogue`.
 * Returns null only for an empty catalogue.
 */
export function selectRadiator(
  requiredRatedOutputW: number,
  catalogue: RadiatorModel[],
): RadiatorSelection | null {
  if (catalogue.length === 0) return null;

  // No positive requirement (e.g. negative element loss) → smallest radiator.
  if (!(requiredRatedOutputW > 0)) {
    const smallest = catalogue.reduce((a, b) =>
      b.ratedOutputW < a.ratedOutputW ? b : a,
    );
    return {
      specification: smallest.specification,
      ratedOutputW: smallest.ratedOutputW,
      meetsRequirement: true,
    };
  }

  const adequate = catalogue.filter((r) => r.ratedOutputW >= requiredRatedOutputW);
  if (adequate.length > 0) {
    const best = adequate.reduce((a, b) =>
      b.ratedOutputW < a.ratedOutputW ? b : a,
    );
    return {
      specification: best.specification,
      ratedOutputW: best.ratedOutputW,
      meetsRequirement: true,
    };
  }

  // Nothing large enough — return the largest and let the caller flag it.
  const largest = catalogue.reduce((a, b) =>
    b.ratedOutputW > a.ratedOutputW ? b : a,
  );
  return {
    specification: largest.specification,
    ratedOutputW: largest.ratedOutputW,
    meetsRequirement: false,
  };
}
