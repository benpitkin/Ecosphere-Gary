import { describe, it, expect } from "vitest";
import {
  matchHeatPump,
  selectHeatPump,
  type HeatPumpModel,
} from "@/lib/engine/heatpump";

// Synthetic catalogue (stand-in for manufacturer data) — a Vaillant-like model
// whose 45 °C figures match the 3 Orchard Close fixture.
const aroTherm7: HeatPumpModel = {
  manufacturer: "Vaillant",
  model: "aroTHERM pro 7kW",
  performance: [
    { flowTempC: 40, capacityKw: 7.9, scop: 4.45 },
    { flowTempC: 45, capacityKw: 7.54, scop: 4.13 },
    { flowTempC: 50, capacityKw: 7.2, scop: 3.7 },
  ],
};

const aroTherm5: HeatPumpModel = {
  manufacturer: "Vaillant",
  model: "aroTHERM pro 5kW",
  performance: [
    { flowTempC: 40, capacityKw: 5.6, scop: 4.5 },
    { flowTempC: 45, capacityKw: 5.3, scop: 4.2 },
    { flowTempC: 50, capacityKw: 5.0, scop: 3.75 },
  ],
};

describe("matchHeatPump", () => {
  it("reproduces the 3 Orchard Close cover and SCOP at 45 °C", () => {
    const m = matchHeatPump(5.65, 45, aroTherm7)!;
    expect(m.coverRatio).toBeCloseTo(1.33, 2);
    expect(m.scop).toBe(4.13);
    expect(m.flags).toHaveLength(0);
  });

  it("reads a different SCOP per flow temp", () => {
    expect(matchHeatPump(5.65, 40, aroTherm7)!.scop).toBe(4.45);
    expect(matchHeatPump(5.65, 50, aroTherm7)!.scop).toBe(3.7);
  });

  it("flags an undersized match as a blocker", () => {
    const m = matchHeatPump(9.0, 45, aroTherm7)!;
    expect(m.coverRatio).toBeLessThan(1);
    expect(m.flags.some((f) => f.code === "heat_pump_undersized")).toBe(true);
  });

  it("flags an implausibly oversized match as a warning", () => {
    const m = matchHeatPump(3.0, 45, aroTherm7)!; // 7.54/3 = 2.51x
    expect(m.flags.some((f) => f.code === "heat_pump_oversized")).toBe(true);
  });

  it("returns null when the model has no point for the flow temp", () => {
    const partial: HeatPumpModel = {
      manufacturer: "X",
      model: "Y",
      performance: [{ flowTempC: 45, capacityKw: 6, scop: 4 }],
    };
    expect(matchHeatPump(5, 40, partial)).toBeNull();
  });
});

describe("selectHeatPump", () => {
  it("picks the smallest adequately-sized model", () => {
    const m = selectHeatPump(5.0, 45, [aroTherm7, aroTherm5])!;
    expect(m.model).toBe("aroTHERM pro 5kW"); // 5.3 kW covers 5.0, tighter than 7.54
    expect(m.coverRatio).toBeGreaterThanOrEqual(1);
  });

  it("falls back to the largest model when none fully covers", () => {
    const m = selectHeatPump(9.0, 45, [aroTherm7, aroTherm5])!;
    expect(m.model).toBe("aroTHERM pro 7kW"); // closest miss (highest cover)
  });

  it("returns null when no candidate has data for the flow temp", () => {
    expect(selectHeatPump(5, 40, [])).toBeNull();
  });
});
