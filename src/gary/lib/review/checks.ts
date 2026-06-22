import {
  type ReviewFinding,
  type ReviewInput,
  type ReviewMetrics,
  type ReviewRoom,
} from "@/gary/contracts/review";
import { outputAtConditionsW } from "@/gary/lib/engine/emitter";
import { HEAT_PUMP_MATCH } from "@/gary/config/decisions";

/**
 * Deterministic design & quote checks (no LLM).
 * =============================================
 *
 * Pure functions that produce auditable findings + metrics from a `ReviewInput`.
 * Reuses the engine's EN442 emitter correction and the heat-pump cover-ratio
 * thresholds so the reviewer applies the *same* rules the design engine does.
 */

/** Output a room's emitters deliver at the design conditions, watts. */
function roomProvidedW(room: ReviewRoom, flowTempC: number | undefined, roomTempFallback: number): number {
  const roomTempC = room.roomTempC ?? roomTempFallback;
  return room.emitters
    .filter((e) => (e.status ?? "new") !== "remove")
    .reduce((sum, e) => {
      if (typeof e.outputW === "number") return sum + e.outputW; // already at conditions
      if (typeof e.ratedOutputW50 === "number" && flowTempC !== undefined) {
        return sum + outputAtConditionsW(e.ratedOutputW50, flowTempC, roomTempC);
      }
      return sum; // no usable output figure for this emitter
    }, 0);
}

export interface ChecksOutput {
  findings: ReviewFinding[];
  metrics: ReviewMetrics;
  verdict: "pass" | "review" | "fail";
}

export function runReviewChecks(input: ReviewInput): ChecksOutput {
  const { design, quote } = input;
  const findings: ReviewFinding[] = [];

  // --- Heat-pump cover ---
  const cap = design.heatPump.capacityAtDesignKw;
  const loss = design.wholeHouseHeatLossKw;
  let coverRatio: number | null = null;
  if (typeof cap === "number" && loss > 0) {
    coverRatio = cap / loss;
    if (coverRatio < HEAT_PUMP_MATCH.minCoverRatio) {
      findings.push({
        code: "heat_pump_undersized",
        message: `Heat pump ${cap} kW covers only ${(coverRatio * 100).toFixed(0)} % of the ${loss} kW design heat loss — under 100 %.`,
        severity: "blocker",
      });
    } else if (coverRatio > HEAT_PUMP_MATCH.oversizeFlagRatio) {
      findings.push({
        code: "heat_pump_oversized",
        message: `Heat pump ${cap} kW is ${(coverRatio * 100).toFixed(0)} % of design heat loss — check for short-cycling.`,
        severity: "warning",
      });
    }
  } else {
    findings.push({
      code: "heat_pump_capacity_missing",
      message: "No heat-pump capacity-at-design-conditions given — cover can't be verified.",
      severity: "warning",
    });
  }

  // --- Per-room emitter adequacy ---
  const roomTempFallback = 21;
  let roomsChecked = 0;
  let roomsUndersized = 0;
  for (const room of design.rooms) {
    if (room.heatLossW <= 0) continue; // nothing to meet
    const provided = roomProvidedW(room, design.flowTempC, roomTempFallback);
    if (provided <= 0) continue; // no usable emitter figure — skip rather than mis-flag
    roomsChecked += 1;
    if (provided < room.heatLossW) {
      roomsUndersized += 1;
      findings.push({
        code: "emitter_undersized",
        message: `${room.name}: emitters provide ~${Math.round(provided)} W vs ${room.heatLossW} W demand (${Math.round((provided / room.heatLossW) * 100)} %).`,
        severity: "warning",
      });
    }
  }

  // --- MCS031 presence (MCS-required) ---
  if (!design.mcs031Present) {
    findings.push({
      code: "mcs031_missing",
      message: "No MCS031 performance estimate attached — required for an MCS-accredited install.",
      severity: "blocker",
    });
  }

  // --- Quote ↔ design coverage (only when a quote is supplied) ---
  if (quote) {
    const inferCategory = (l: { description: string; category?: string }): string => {
      if (l.category) return l.category;
      const d = l.description.toLowerCase();
      if (/heat pump|aerona|arotherm|ecodan|daikin|vaillant|grant/.test(d)) return "heat_pump";
      if (/cylinder|tank|dhw/.test(d)) return "cylinder";
      if (/radiator|rad |stelrad|emitter|ufh|underfloor/.test(d)) return "radiator";
      return "other";
    };
    const lines = quote.lineItems.map((l) => ({ ...l, cat: inferCategory(l) }));
    const qtyOf = (cat: string) =>
      lines.filter((l) => l.cat === cat).reduce((n, l) => n + (l.quantity ?? 1), 0);

    if (qtyOf("heat_pump") === 0) {
      findings.push({
        code: "quote_missing_heat_pump",
        message: "Quote has no heat-pump line item — the design specifies one.",
        severity: "blocker",
      });
    }
    if (design.hasDhw && qtyOf("cylinder") === 0) {
      findings.push({
        code: "quote_missing_cylinder",
        message: "Design includes DHW but the quote has no hot-water cylinder.",
        severity: "warning",
      });
    }
    const designNewRads = design.rooms
      .flatMap((r) => r.emitters)
      .filter((e) => e.type === "radiator" && (e.status === "new" || e.status === "replacement")).length;
    const quoteRads = qtyOf("radiator");
    if (designNewRads > 0 && quoteRads < designNewRads) {
      findings.push({
        code: "quote_radiators_short",
        message: `Design needs ${designNewRads} new/replacement radiators but the quote lists ${quoteRads}.`,
        severity: "warning",
      });
    }
  }

  const verdict: ChecksOutput["verdict"] = findings.some((f) => f.severity === "blocker")
    ? "fail"
    : findings.some((f) => f.severity === "warning")
      ? "review"
      : "pass";

  return {
    findings,
    metrics: {
      coverRatio: coverRatio === null ? null : Math.round(coverRatio * 100) / 100,
      roomsChecked,
      roomsUndersized,
    },
    verdict,
  };
}
