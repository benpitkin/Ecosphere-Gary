import { describe, it, expect } from "vitest";
import {
  OPTIONS,
  OPTION_COUNT,
  FLOW_TEMPS_C,
  DEFAULT_OPTION,
  EMITTER_SIZING,
  meanWaterTempC,
  HEAT_PUMP_MATCH,
  TECHNICAL_DEFAULTS,
  OWNERSHIP,
  REASONING,
} from "@/config/decisions";

describe("EcoSphere design rules", () => {
  it("always offers exactly three options at 40/45/50 °C", () => {
    expect(OPTION_COUNT).toBe(3);
    expect(OPTIONS.map((o) => o.flowTempC)).toEqual([40, 45, 50]);
    expect(FLOW_TEMPS_C).toEqual([40, 45, 50]);
  });

  it("orders options eco → sweet_spot → budget with sweet_spot as default", () => {
    expect(OPTIONS.map((o) => o.key)).toEqual(["eco", "sweet_spot", "budget"]);
    expect(DEFAULT_OPTION).toBe("sweet_spot");
  });

  it("captures the capital/radiator trade-off direction", () => {
    const eco = OPTIONS[0];
    const budget = OPTIONS[2];
    expect(eco.capitalRank).toBe("highest");
    expect(eco.radiators).toBe("largest");
    expect(budget.capitalRank).toBe("lowest");
    expect(budget.radiators).toBe("smallest");
  });

  it("uses ΔT 5 °C and computes mean water temp as flow − 2.5", () => {
    expect(EMITTER_SIZING.deltaTC).toBe(5);
    expect(EMITTER_SIZING.demandCoverage).toBe(1.0);
    expect(meanWaterTempC(45)).toBe(42.5);
    expect(meanWaterTempC(40)).toBe(37.5);
  });

  it("requires heat-pump cover ≥ 100 % of design heat loss", () => {
    expect(HEAT_PUMP_MATCH.minCoverRatio).toBe(1.0);
    expect(HEAT_PUMP_MATCH.oversizeFlagRatio).toBeGreaterThan(1.0);
  });

  it("encodes the EcoSphere technical defaults", () => {
    expect(TECHNICAL_DEFAULTS.heatPumps).toContain("Vaillant aroTHERM");
    expect(TECHNICAL_DEFAULTS.heatPumps).toContain("Grant");
    expect(TECHNICAL_DEFAULTS.radiators).toBe("Stelrad");
    expect(TECHNICAL_DEFAULTS.primaryRunMetres).toBe(10);
  });

  it("splits ownership: Gary owns design, Core owns prices", () => {
    expect(OWNERSHIP.design).toBe("gary");
    expect(OWNERSHIP.prices).toBe("core");
  });

  it("uses a reactive/observational reasoning layer", () => {
    expect(REASONING.mode).toBe("reactive-observational");
  });
});
