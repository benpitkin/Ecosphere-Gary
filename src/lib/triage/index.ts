import {
  TRIAGE_VERSION,
  type TriageInput,
  type TriageResult,
  type TriageFlag,
  type Band,
  type NextAction,
  type Suitability,
} from "@/contracts/triage";

/**
 * Deterministic triage engine (pre-survey).
 * =========================================
 *
 * Pure, no I/O, no LLM. Turns an address + a few qualifying answers into a
 * recommended next action, an *indicative* heat-pump size band, and the flags
 * that drove the judgement. Everything here is a coarse pre-survey estimate —
 * **not** an MCS design (that's the deterministic engine, post-survey).
 *
 * A Claude conversational layer can sit in front later to gather the answers in
 * natural language; the judgement itself stays deterministic and auditable.
 */

/** Heat-loss intensity assumptions (W/m²) as a low–high band by wall type. */
const W_PER_M2_BY_WALL: Record<string, Band> = {
  cavity_filled: { low: 30, high: 55 },
  cavity_unfilled: { low: 45, high: 75 },
  solid: { low: 70, high: 110 },
  timber: { low: 40, high: 70 },
  unknown: { low: 45, high: 90 },
};

/** Common nominal ASHP sizes (kW) to round an estimate up to. */
const NOMINAL_HP_SIZES_KW = [5, 6, 7, 8.5, 10, 12, 14, 16];

/** Estimate the indicative whole-house heat loss band (kW) from property data. */
export function estimateHeatLossKw(
  floorAreaM2: number,
  wallType: string | undefined,
  glazing: string | undefined,
  ageBand: string | undefined,
): Band {
  const base = W_PER_M2_BY_WALL[wallType ?? "unknown"] ?? W_PER_M2_BY_WALL.unknown;
  let { low, high } = base;
  if (glazing === "single") {
    low += 10;
    high += 10;
  }
  if (ageBand === "post_2000") {
    low = Math.max(20, low - 10);
    high = Math.max(30, high - 10);
  }
  return {
    low: Math.round((floorAreaM2 * low) / 100) / 10, // → kW, 1 dp
    high: Math.round((floorAreaM2 * high) / 100) / 10,
  };
}

/** Smallest nominal HP size that covers the high end of the estimate. */
export function suggestNominalKw(highKw: number): number {
  return NOMINAL_HP_SIZES_KW.find((s) => s >= highKw) ?? NOMINAL_HP_SIZES_KW[NOMINAL_HP_SIZES_KW.length - 1];
}

export function triage(input: TriageInput): TriageResult {
  const flags: TriageFlag[] = [];
  const basis: string[] = [];
  const { property: p, answers: a } = input;

  // --- Positive / neutral fuel signal ---
  if (p.mainFuel && ["oil", "lpg", "electric"].includes(p.mainFuel)) {
    flags.push({ code: "off_gas", message: "Off the mains-gas grid — typically a strong heat-pump case.", severity: "info" });
    basis.push("Off-gas property: strong running-cost/carbon case vs oil/LPG/electric.");
  } else if (p.mainFuel === "mains_gas") {
    basis.push("On mains gas: viable, savings depend on tariff and incentives.");
  }

  // --- Complexity flags ---
  if (a.listedOrConservation === "yes") {
    flags.push({ code: "listed_or_conservation", message: "Listed building / conservation area — external unit & fabric changes need care.", severity: "warning" });
  }
  if (p.wallType === "solid") {
    flags.push({ code: "solid_walls", message: "Solid walls → higher heat loss, larger emitters, likely higher capital.", severity: "warning" });
  }

  // --- Blockers ---
  if (a.spaceForUnitAndCylinder === "no") {
    flags.push({ code: "no_space", message: "No space reported for the outdoor unit and/or hot-water cylinder.", severity: "blocker" });
  }
  if (a.ownerOccupier === "no") {
    flags.push({ code: "not_owner_occupier", message: "Not owner-occupied — decision-maker/landlord consent needed.", severity: "warning" });
  }

  // --- Sizing estimate (needs floor area) ---
  let indicativeHeatLossKw: Band | null = null;
  let indicativeHeatPumpKw: Band | null = null;
  let suggestedNominalKw: number | null = null;
  if (p.floorAreaM2) {
    indicativeHeatLossKw = estimateHeatLossKw(p.floorAreaM2, p.wallType, p.glazing, p.ageBand);
    indicativeHeatPumpKw = {
      low: indicativeHeatLossKw.low,
      high: Math.round(indicativeHeatLossKw.high * 1.15 * 10) / 10,
    };
    suggestedNominalKw = suggestNominalKw(indicativeHeatPumpKw.high);
    basis.push(
      `Indicative heat loss ${indicativeHeatLossKw.low}–${indicativeHeatLossKw.high} kW from ${p.floorAreaM2} m² and ${p.wallType ?? "unknown"} walls (coarse estimate, not a survey).`,
    );
  } else {
    flags.push({ code: "no_floor_area", message: "No floor area — cannot give an indicative size yet.", severity: "info" });
  }

  // --- Confidence from how much we know ---
  const known = [p.floorAreaM2, p.wallType, p.glazing, p.mainFuel].filter(
    (v) => v !== undefined && v !== "unknown",
  ).length;
  const confidence: TriageResult["confidence"] = known >= 3 ? "high" : known >= 1 ? "medium" : "low";

  // --- Decision ---
  const hasBlocker = flags.some((f) => f.severity === "blocker");
  const hasComplexity = flags.some(
    (f) => f.code === "listed_or_conservation" || f.code === "solid_walls" || f.code === "not_owner_occupier",
  );

  let nextAction: NextAction;
  let suitability: Suitability;
  if (hasBlocker) {
    nextAction = "human_follow_up";
    suitability = "unlikely";
    basis.push("A blocker was raised — needs a human conversation before any survey.");
  } else if (!p.floorAreaM2) {
    nextAction = "gather_info";
    suitability = "unclear";
    basis.push("Not enough property data to judge — gather floor area / fabric, then re-triage.");
  } else if (hasComplexity) {
    nextAction = "human_follow_up";
    suitability = "promising_complex";
    basis.push("Promising but has complicating factors — worth a human follow-up to confirm fit.");
  } else {
    nextAction = "book_survey";
    suitability = "good";
    basis.push("No blockers and a workable estimate — recommend booking a full survey.");
  }

  return {
    version: TRIAGE_VERSION,
    nextAction,
    suitability,
    indicativeHeatLossKw,
    indicativeHeatPumpKw,
    suggestedNominalKw,
    confidence,
    flags,
    basis,
  };
}
