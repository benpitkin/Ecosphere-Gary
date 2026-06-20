import type { RadiatorModel } from "@/lib/engine/radiator";

/**
 * Stelrad Compact catalogue — ΔT50 rated outputs (EcoSphere standard radiator).
 * ============================================================================
 *
 * Built from Stelrad's published **Compact Range** technical data: the EN 442
 * (CETIAT-certified) output per metre at ΔT50 (operating temperature
 * 75/65/20 °C — the UK industry standard), by panel type and height. A model's
 * ΔT50 rated output is that certified W/m × its length, which is exactly what the
 * per-metre figure is published for. Source: Stelrad Compact Range technical PDS.
 *
 * The engine's `selectRadiator` chooses the smallest catalogue model whose ΔT50
 * rating meets the required output, then the engine corrects that rating to the
 * option's flow temp. Using the certified W/m keeps this grounded in real
 * manufacturer data; if Ben wants the exact per-model tabulated values (which
 * include small end effects) they can replace `WATTS_PER_METRE_DT50` — the shape
 * doesn't change.
 */

/** Stelrad panel types, with the radiator-book label the survey/report uses. */
const TYPE_LABEL = {
  P1: "Type 10 (P1)",
  K1: "Type 11 (K1)",
  "P+": "Type 21 (P+)",
  K2: "Type 22 (K2)",
  K3: "Type 33 (K3)",
} as const;
type PanelType = keyof typeof TYPE_LABEL;

/**
 * Certified output (watts per metre of length) at ΔT50, by type and panel
 * height (mm). From the Stelrad Compact "EN 442 Certification Data – CETIAT"
 * table (W/m at 75/65/20).
 */
const WATTS_PER_METRE_DT50: Record<PanelType, Partial<Record<number, number>>> = {
  P1: { 450: 474, 600: 619 },
  K1: { 300: 509, 450: 756, 600: 980, 700: 1117 },
  "P+": { 300: 745, 450: 1055, 600: 1345, 700: 1530 },
  K2: { 300: 982, 450: 1371, 600: 1732, 700: 1961 },
  K3: { 300: 1349, 500: 2056, 600: 2389, 700: 2712 },
};

/** Standard catalogue lengths (mm) by type, from the Compact Range tables. */
const LENGTHS_MM: Record<PanelType, number[]> = {
  P1: [500, 1000, 1500, 2000, 2500, 3000],
  K1: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000],
  "P+": [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000],
  K2: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000],
  K3: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000],
};

function buildCatalogue(): RadiatorModel[] {
  const models: RadiatorModel[] = [];
  for (const type of Object.keys(WATTS_PER_METRE_DT50) as PanelType[]) {
    const byHeight = WATTS_PER_METRE_DT50[type];
    for (const heightStr of Object.keys(byHeight)) {
      const height = Number(heightStr);
      const wPerMetre = byHeight[height]!;
      for (const length of LENGTHS_MM[type]) {
        models.push({
          specification: `Stelrad Compact ${TYPE_LABEL[type]} ${height}x${length} mm`,
          ratedOutputW: Math.round((wPerMetre * length) / 1000),
        });
      }
    }
  }
  return models;
}

/** The Stelrad Compact catalogue at ΔT50 — the engine's default radiator set. */
export const STELRAD_COMPACT_CATALOGUE: RadiatorModel[] = buildCatalogue();
