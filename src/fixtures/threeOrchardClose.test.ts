import { describe, it, expect } from "vitest";
import { parseSurveyObject } from "@/contracts/survey";
import { correctionFactor } from "@/lib/engine/emitter";
import { matchHeatPump } from "@/lib/engine/heatpump";
import { modelAt, capacityKw } from "@/lib/engine/catalog/vaillantAroThermPro7kw";
import {
  threeOrchardCloseSurvey,
  REPORTED_TYPE21_P_600H,
  EXPECTED_HEAT_PUMP,
} from "@/fixtures/threeOrchardClose";

describe("3 Orchard Close — survey fixture shape", () => {
  it("validates against the SurveyObject contract", () => {
    expect(() => parseSurveyObject(threeOrchardCloseSurvey)).not.toThrow();
  });

  it("has 13 rooms incl. two Hall/Landing keyed by floor", () => {
    expect(threeOrchardCloseSurvey.rooms).toHaveLength(13);
    const halls = threeOrchardCloseSurvey.rooms.filter((r) => r.name === "Hall/Landing");
    expect(halls.map((r) => r.floor).sort()).toEqual(["first", "ground"]);
  });

  it("room heat losses sum to the whole-house figure", () => {
    const sum = threeOrchardCloseSurvey.rooms.reduce((a, r) => a + r.heatLossW, 0);
    expect(Math.abs(sum - threeOrchardCloseSurvey.wholeHouse.heatLossW)).toBeLessThanOrEqual(10);
  });

  it("captures the incomplete sound assessment as a flag (never assumed done)", () => {
    expect(
      threeOrchardCloseSurvey.flags.some((f) => f.code === "sound_assessment_incomplete"),
    ).toBe(true);
  });
});

describe("3 Orchard Close — heat-pump matching vs the report", () => {
  it("interpolates 7.54 kW at 45 °C / -1.5 °C from the real capacity matrix", () => {
    expect(capacityKw(-1.5, 45)).toBeCloseTo(7.54, 2);
  });

  it("reproduces the report's cover ratio and per-flow-temp SCOP", () => {
    const model = modelAt(EXPECTED_HEAT_PUMP.designOutsideTempC);
    const m = matchHeatPump(5.65, 45, model)!;
    expect(m.coverRatio).toBeCloseTo(EXPECTED_HEAT_PUMP.coverRatio, 2);
    expect(m.scop).toBe(EXPECTED_HEAT_PUMP.scopByFlow[45]);
    expect(m.flags).toHaveLength(0);
    expect(matchHeatPump(5.65, 40, model)!.scop).toBe(EXPECTED_HEAT_PUMP.scopByFlow[40]);
    expect(matchHeatPump(5.65, 50, model)!.scop).toBe(EXPECTED_HEAT_PUMP.scopByFlow[50]);
  });
});

describe("3 Orchard Close — EN442 correction matches the report's method", () => {
  it("back-computes consistent Stelrad ratings (~W/mm) across 18 °C and 21 °C rooms", () => {
    // impliedRated = reportedOutput@45 / correctionFactor(45, roomTemp).
    // If the correction exponent is right, a fixed radiator series (Type 21 P+,
    // 600 mm high) should yield a near-constant W per mm of length — across
    // different room set-points. This is a cross-temperature proof, not circular.
    const wPerMm = REPORTED_TYPE21_P_600H.map((r) => {
      const impliedRated = r.outputW45 / correctionFactor(45, r.roomTempC);
      return impliedRated / r.lengthMm;
    });
    const mean = wPerMm.reduce((a, b) => a + b, 0) / wPerMm.length;
    for (const v of wPerMm) {
      expect(Math.abs(v - mean) / mean).toBeLessThan(0.02); // within 2 %
    }
    // sanity: Stelrad Type 21 P+ 600 mm high is ~1.28 W/mm at ΔT50.
    expect(mean).toBeGreaterThan(1.2);
    expect(mean).toBeLessThan(1.35);
  });

  it("reproduces the report's Living/Lounge 97 % demand-met arithmetic", () => {
    const living = threeOrchardCloseSurvey.rooms.find(
      (r) => r.name === "Living/Lounge",
    )!;
    const total = (living.emitters ?? []).reduce((a, e) => a + (e.outputW ?? 0), 0);
    expect(total).toBe(852);
    expect(total / living.heatLossW).toBeCloseTo(0.97, 2);
  });
});
