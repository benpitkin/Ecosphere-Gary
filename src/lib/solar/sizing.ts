import {
  type Orientation,
  type Shading,
  type SolarEnquiry,
  type SolarFlag,
  type SolarSizing,
} from "@/contracts/solar";

/**
 * Deterministic solar pre-design sizing — the spine (no LLM).
 * ==========================================================
 *
 * Pure, tested TypeScript. Turns a `SolarEnquiry` into an indicative
 * `SolarSizing`: system size (kWp), panel count, inverter, battery, estimated
 * generation, self-consumption, and the DNO G98/G99 threshold. The Claude layer
 * writes the brief *around* these numbers — it never invents them. Every figure
 * is **indicative pre-survey**, not a quote, and the constants below are
 * documented EcoSphere/UK-South-West defaults that a real survey (or OpenSolar)
 * refines.
 */

export const SOLAR_DEFAULTS = {
  /** Modern panel rating, W (used to convert kWp ↔ panel count). */
  panelWatt: 440,
  /** Roughly usable roof area per kWp installed, m². */
  areaPerKwpM2: 5.5,
  /**
   * Base specific yield for a South-facing ~35° array in the South-West, before
   * orientation/pitch/shading derates: kWh per kWp per year. Indicative
   * (MCS/SAP irradiance methods refine it by exact location).
   */
  baseSpecificYield: 1000,
  /** Self-consumption (share of generation used on-site): PV-only vs +battery. */
  selfConsumptionPvOnly: 0.3,
  selfConsumptionWithBattery: 0.65,
  /** DNO: inverter export above this per phase needs G99 prior approval, kW. */
  perPhaseLimitKw: 3.68,
  /** Ofgem typical domestic consumption values, kWh/yr. */
  tdcv: { low: 1800, medium: 2700, high: 4100 },
  /** Additional annual demand, kWh. */
  evKwh: 3000,
  heatPumpKwh: 3000,
  /** Battery: fraction of daily use it should cover, and sensible clamps (kWh). */
  batteryDailyCoverage: 0.55,
  batteryMinKwh: 5,
  batteryMaxKwh: 15,
} as const;

/** Orientation yield factor relative to due South. */
const ORIENTATION_FACTOR: Record<Orientation, number> = {
  S: 1.0,
  SE: 0.96,
  SW: 0.96,
  E: 0.86,
  W: 0.86,
  NE: 0.75,
  NW: 0.75,
  N: 0.6,
  unknown: 1.0,
};

/** Shading yield factor. */
const SHADING_FACTOR: Record<Shading, number> = {
  none: 1.0,
  light: 0.95,
  moderate: 0.85,
  heavy: 0.7,
  unknown: 1.0,
};

/** Pitch yield factor (best near 30–45°). */
function pitchFactor(pitchDeg?: number): number {
  if (pitchDeg === undefined) return 1.0;
  if (pitchDeg >= 30 && pitchDeg <= 45) return 1.0;
  if (pitchDeg >= 15 && pitchDeg <= 55) return 0.97;
  return 0.9;
}

const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Effective specific yield for one roof face (kWh/kWp/yr). */
function faceYield(
  orientation: Orientation,
  shading: Shading,
  pitchDeg?: number,
): number {
  return (
    SOLAR_DEFAULTS.baseSpecificYield *
    ORIENTATION_FACTOR[orientation] *
    SHADING_FACTOR[shading] *
    pitchFactor(pitchDeg)
  );
}

export function sizeSolar(enquiry: SolarEnquiry): SolarSizing {
  const d = SOLAR_DEFAULTS;
  const flags: SolarFlag[] = [];
  const assumptions: string[] = [];

  // --- Annual consumption ---
  let consumptionKwh: number;
  let sizingBasis: SolarSizing["sizingBasis"];
  if (typeof enquiry.annualConsumptionKwh === "number" && enquiry.annualConsumptionKwh > 0) {
    consumptionKwh = enquiry.annualConsumptionKwh;
    sizingBasis = "usage";
  } else if (enquiry.occupants || enquiry.bedrooms) {
    const size = enquiry.occupants ?? enquiry.bedrooms ?? 0;
    const band = size <= 2 ? d.tdcv.low : size >= 4 ? d.tdcv.high : d.tdcv.medium;
    consumptionKwh = band;
    sizingBasis = "occupancy";
    assumptions.push(
      `Annual use estimated from occupancy (${size}) at ${band} kWh — no meter data supplied.`,
    );
    flags.push({
      code: "no_usage_data",
      message: "No metered consumption — sizing uses an occupancy estimate; confirm with a bill or half-hourly data.",
      severity: "warning",
    });
  } else {
    consumptionKwh = d.tdcv.medium;
    sizingBasis = "default";
    assumptions.push(`Annual use defaulted to a medium household (${d.tdcv.medium} kWh).`);
    flags.push({
      code: "no_usage_data",
      message: "No usage or occupancy supplied — sizing uses a default household; treat as a rough placeholder.",
      severity: "warning",
    });
  }
  if (enquiry.hasEv) {
    consumptionKwh += d.evKwh;
    assumptions.push(`Added ${d.evKwh} kWh for EV charging.`);
  }
  if (enquiry.hasHeatPump) {
    consumptionKwh += d.heatPumpKwh;
    assumptions.push(`Added ${d.heatPumpKwh} kWh for a heat pump.`);
  }

  // --- Best roof face → effective specific yield ---
  const faces = enquiry.roofFaces;
  let specificYield: number;
  if (faces.length > 0) {
    const best = faces
      .map((f) => ({ f, y: faceYield(f.orientation, f.shading, f.pitchDeg) }))
      .reduce((a, b) => (b.y > a.y ? b : a));
    specificYield = best.y;
    if (best.f.orientation === "unknown") {
      flags.push({
        code: "orientation_unknown",
        message: "Roof orientation not given — assumed South-equivalent; confirm on survey (large yield impact).",
        severity: "warning",
      });
    }
    if (best.f.shading === "unknown") {
      flags.push({
        code: "shading_unconfirmed",
        message: "Shading not assessed — assumed none; a survey/shade analysis is required (can materially cut yield).",
        severity: "warning",
      });
    } else if (best.f.shading === "moderate" || best.f.shading === "heavy") {
      flags.push({
        code: "shading_significant",
        message: `Reported ${best.f.shading} shading reduces yield — optimisers/panel-level MPPT and a shade study needed.`,
        severity: "warning",
      });
    }
    if (faces.length > 1) {
      assumptions.push("Multiple roof faces noted; sized on the best face — a split array may capture more.");
    }
  } else {
    specificYield = d.baseSpecificYield;
    assumptions.push("No roof faces supplied — assumed a South-facing ~35° pitch, no shading.");
    flags.push({
      code: "roof_not_assessed",
      message: "No roof information — orientation, pitch and shading are assumed; a survey is required.",
      severity: "warning",
    });
  }

  // --- System size (kWp) ---
  // Usage-led: size so annual generation ≈ annual consumption. Fall back to
  // roof area when there's no usage signal at all.
  let kwp: number;
  const totalRoofAreaM2 = faces.reduce((a, f) => a + (f.areaM2 ?? 0), 0);
  const maxKwpByRoof = totalRoofAreaM2 > 0 ? totalRoofAreaM2 / d.areaPerKwpM2 : Infinity;

  if (sizingBasis === "default" && totalRoofAreaM2 > 0) {
    kwp = maxKwpByRoof;
    sizingBasis = "roof_area";
    assumptions.push("Sized to fill the available roof area (no usage data).");
  } else {
    kwp = consumptionKwh / specificYield;
  }

  if (kwp > maxKwpByRoof) {
    kwp = maxKwpByRoof;
    flags.push({
      code: "roof_capacity_limited",
      message: "System capped by available roof area — it won't fully offset the estimated demand.",
      severity: "info",
    });
  }
  kwp = Math.max(kwp, d.panelWatt / 1000); // at least one panel

  // Resolve to a whole number of panels, then recompute kWp from that. When the
  // roof is the binding constraint, floor to whole panels so we never exceed the
  // available area.
  const panelWatt = d.panelWatt;
  let panelCount = Math.max(1, Math.round((kwp * 1000) / panelWatt));
  if (Number.isFinite(maxKwpByRoof)) {
    const maxPanels = Math.max(1, Math.floor((maxKwpByRoof * 1000) / panelWatt));
    panelCount = Math.min(panelCount, maxPanels);
  }
  kwp = round((panelCount * panelWatt) / 1000, 2);

  // --- Generation, offset, inverter ---
  const generationKwh = round(kwp * specificYield);
  const offsetPct = round((generationKwh / consumptionKwh) * 100);
  const inverterKw = round(kwp, 2); // indicative: inverter ≈ array size

  // --- Battery ---
  const goalsText = `${enquiry.goals ?? ""} ${enquiry.notes ?? ""}`.toLowerCase();
  const wantsBattery =
    enquiry.wantsBattery === true ||
    /batter|storage|backup|self[- ]?consum|off[- ]?grid/.test(goalsText);
  const recommendBattery = wantsBattery || consumptionKwh >= 3500 || enquiry.hasEv === true;
  let batteryKwh: number | null = null;
  if (recommendBattery) {
    const daily = consumptionKwh / 365;
    batteryKwh = round(
      Math.min(Math.max(daily * d.batteryDailyCoverage, d.batteryMinKwh), d.batteryMaxKwh),
    );
  }
  const selfConsumptionPct = round(
    (batteryKwh ? d.selfConsumptionWithBattery : d.selfConsumptionPvOnly) * 100,
  );

  // --- DNO G98 / G99 ---
  const perPhaseLimitKw = d.perPhaseLimitKw;
  // Single-phase (or unknown) is assessed per phase; three-phase allows the
  // limit on each of three phases.
  const effectiveLimit = enquiry.phase === "three" ? perPhaseLimitKw * 3 : perPhaseLimitKw;
  const g99Required = inverterKw > effectiveLimit;
  if (g99Required) {
    flags.push({
      code: "dno_g99_required",
      message: `Inverter ${inverterKw} kW exceeds the ${effectiveLimit} kW ${enquiry.phase === "three" ? "(three-phase) " : ""}G98 limit — a DNO G99 application is required before install (or export-limit to ≤ ${effectiveLimit} kW for G98).`,
      severity: "warning",
    });
  } else {
    assumptions.push(`Inverter within the ${effectiveLimit} kW limit — G98 notification expected (no prior DNO approval).`);
  }
  if (enquiry.phase === "unknown") {
    flags.push({
      code: "phase_unknown",
      message: "Supply phase not confirmed — the DNO threshold assumes single-phase; verify on survey.",
      severity: "info",
    });
  }

  // --- Standing flags ---
  if (enquiry.listedOrConservation === "yes") {
    flags.push({
      code: "listed_or_conservation",
      message: "Listed building / conservation area — planning permission likely needed; panel placement/visibility constrained.",
      severity: "warning",
    });
  }
  flags.push({
    code: "structural_check_required",
    message: "Roof structure and condition must be confirmed on survey before specifying the array.",
    severity: "info",
  });

  return {
    recommendedKwp: kwp,
    panelCount,
    panelWatt,
    inverterKw,
    batteryKwh,
    estimatedAnnualGenerationKwh: generationKwh,
    specificYieldKwhPerKwp: round(specificYield),
    selfConsumptionPct,
    estimatedAnnualConsumptionKwh: round(consumptionKwh),
    consumptionOffsetPct: offsetPct,
    sizingBasis,
    dno: {
      application: g99Required ? "g99_approval" : "g98_notify",
      perPhaseLimitKw,
      g99Required,
    },
    flags,
    assumptions,
  };
}
