import { describe, it, expect } from "vitest";
import { sizeSolar, SOLAR_DEFAULTS } from "@/gary/lib/solar/sizing";
import { parseSolarEnquiry, type SolarEnquiry } from "@/gary/contracts/solar";

const enquiry = (over: Partial<SolarEnquiry> = {}): SolarEnquiry =>
  parseSolarEnquiry({ address: "1 Test St, Devon", ...over });

describe("deterministic solar sizing", () => {
  it("sizes from usage so generation roughly matches consumption (S/35, no shading)", () => {
    const s = sizeSolar(enquiry({ annualConsumptionKwh: 4000, roofFaces: [{ orientation: "S", pitchDeg: 35, shading: "none" }] }));
    expect(s.sizingBasis).toBe("usage");
    expect(s.specificYieldKwhPerKwp).toBe(1000); // 1000 base × 1 × 1 × 1
    // 4000 / 1000 = 4 kWp ≈ 9 panels @ 440 W (3.96 kWp)
    expect(s.panelCount).toBe(9);
    expect(s.recommendedKwp).toBeCloseTo(3.96, 2);
    expect(s.estimatedAnnualGenerationKwh).toBe(3960);
    expect(s.consumptionOffsetPct).toBe(99);
  });

  it("derates yield for an east-facing, moderately shaded roof", () => {
    const s = sizeSolar(enquiry({ annualConsumptionKwh: 4000, roofFaces: [{ orientation: "E", pitchDeg: 35, shading: "moderate" }] }));
    // 1000 × 0.86 (E) × 0.85 (moderate) = 731
    expect(s.specificYieldKwhPerKwp).toBe(731);
    expect(s.flags.some((f) => f.code === "shading_significant")).toBe(true);
  });

  it("triggers a DNO G99 application when the inverter exceeds 3.68 kW single-phase", () => {
    const s = sizeSolar(enquiry({ annualConsumptionKwh: 6000, phase: "single", roofFaces: [{ orientation: "S", pitchDeg: 35, shading: "none" }] }));
    expect(s.recommendedKwp).toBeGreaterThan(3.68);
    expect(s.dno.g99Required).toBe(true);
    expect(s.dno.application).toBe("g99_approval");
    expect(s.flags.some((f) => f.code === "dno_g99_required")).toBe(true);
  });

  it("stays on G98 for a three-phase supply at the same size", () => {
    const s = sizeSolar(enquiry({ annualConsumptionKwh: 6000, phase: "three", roofFaces: [{ orientation: "S", pitchDeg: 35, shading: "none" }] }));
    expect(s.dno.g99Required).toBe(false);
    expect(s.dno.application).toBe("g98_notify");
  });

  it("caps the array by available roof area and flags it", () => {
    // 11 m² / 5.5 = 2 kWp max, well below what 5000 kWh would want.
    const s = sizeSolar(enquiry({ annualConsumptionKwh: 5000, roofFaces: [{ orientation: "S", pitchDeg: 35, shading: "none", areaM2: 11 }] }));
    expect(s.recommendedKwp).toBeLessThanOrEqual(11 / SOLAR_DEFAULTS.areaPerKwpM2);
    expect(s.flags.some((f) => f.code === "roof_capacity_limited")).toBe(true);
  });

  it("recommends a battery when asked, sized from daily use and clamped", () => {
    const s = sizeSolar(enquiry({ annualConsumptionKwh: 4000, wantsBattery: true, roofFaces: [{ orientation: "S", shading: "none" }] }));
    expect(s.batteryKwh).not.toBeNull();
    expect(s.batteryKwh!).toBeGreaterThanOrEqual(SOLAR_DEFAULTS.batteryMinKwh);
    expect(s.batteryKwh!).toBeLessThanOrEqual(SOLAR_DEFAULTS.batteryMaxKwh);
    expect(s.selfConsumptionPct).toBe(65); // with battery
  });

  it("infers battery interest from free-text goals", () => {
    const s = sizeSolar(enquiry({ annualConsumptionKwh: 3000, goals: "mainly want backup during power cuts", roofFaces: [{ orientation: "S", shading: "none" }] }));
    expect(s.batteryKwh).not.toBeNull();
  });

  it("falls back to an occupancy estimate and flags missing usage data", () => {
    const s = sizeSolar(enquiry({ occupants: 4, roofFaces: [{ orientation: "S", shading: "none" }] }));
    expect(s.sizingBasis).toBe("occupancy");
    expect(s.estimatedAnnualConsumptionKwh).toBe(SOLAR_DEFAULTS.tdcv.high);
    expect(s.flags.some((f) => f.code === "no_usage_data")).toBe(true);
  });

  it("flags assumed roof, orientation and phase when nothing is supplied", () => {
    const s = sizeSolar(enquiry({ annualConsumptionKwh: 3000 }));
    const codes = s.flags.map((f) => f.code);
    expect(codes).toContain("roof_not_assessed");
    expect(codes).toContain("phase_unknown");
    expect(codes).toContain("structural_check_required");
  });

  it("always includes EV/heat-pump load when present", () => {
    const base = sizeSolar(enquiry({ annualConsumptionKwh: 3000, roofFaces: [{ orientation: "S", shading: "none" }] }));
    const withEv = sizeSolar(enquiry({ annualConsumptionKwh: 3000, hasEv: true, roofFaces: [{ orientation: "S", shading: "none" }] }));
    expect(withEv.estimatedAnnualConsumptionKwh).toBe(base.estimatedAnnualConsumptionKwh + SOLAR_DEFAULTS.evKwh);
  });
});
