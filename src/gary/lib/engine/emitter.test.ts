import { describe, it, expect } from "vitest";
import {
  radiatorDeltaTK,
  correctionFactorForDeltaT,
  correctionFactor,
  outputAtConditionsW,
  requiredRatedOutputW,
  sizeRoomEmitter,
} from "@/gary/lib/engine/emitter";

describe("EN442 radiator output correction", () => {
  it("returns factor 1.0 at the rated Δt of 50 K", () => {
    expect(correctionFactorForDeltaT(50)).toBeCloseTo(1.0, 10);
  });

  it("matches the known factor at Δt 30 K ((30/50)^1.3 ≈ 0.515)", () => {
    expect(correctionFactorForDeltaT(30)).toBeCloseTo(0.5151, 3);
  });

  it("clamps to 0 when Δt ≤ 0 (water no warmer than the room)", () => {
    expect(correctionFactorForDeltaT(0)).toBe(0);
    expect(correctionFactorForDeltaT(-5)).toBe(0);
  });

  it("computes radiator Δt as MWT − room (flow − ΔT/2 − room)", () => {
    expect(radiatorDeltaTK(45, 21)).toBe(21.5);
    expect(radiatorDeltaTK(40, 21)).toBe(16.5);
    expect(radiatorDeltaTK(50, 21)).toBe(26.5);
  });

  it("scales rated output by the correction factor at conditions", () => {
    const f = correctionFactor(45, 21);
    expect(outputAtConditionsW(1000, 45, 21)).toBeCloseTo(1000 * f, 6);
  });
});

describe("required rated output (sizing to 100 % demand)", () => {
  it("needs a larger radiator at lower flow temps (the core trade-off)", () => {
    const eco = requiredRatedOutputW(1000, 40, 21);
    const sweet = requiredRatedOutputW(1000, 45, 21);
    const budget = requiredRatedOutputW(1000, 50, 21);
    expect(eco).toBeGreaterThan(sweet);
    expect(sweet).toBeGreaterThan(budget);
    // sanity: sweet spot 45 °C, 21 °C room → ~3 kW rated for 1 kW demand
    expect(sweet).toBeCloseTo(2995.6, 0);
  });

  it("is 0 for non-positive demand (negative element losses are valid)", () => {
    expect(requiredRatedOutputW(0, 45, 21)).toBe(0);
    expect(requiredRatedOutputW(-43, 45, 21)).toBe(0);
  });

  it("is Infinity when conditions cannot deliver heat", () => {
    expect(requiredRatedOutputW(1000, 40, 40)).toBe(Infinity);
  });
});

describe("per-room emitter decision (keep / replace / new)", () => {
  it("keeps an existing emitter that already meets demand", () => {
    const r = sizeRoomEmitter({
      roomDemandW: 1000,
      flowTempC: 45,
      roomTempC: 21,
      existingRatedOutputW: 3100,
    });
    expect(r.status).toBe("keep");
    expect(r.meetsDemand).toBe(true);
  });

  it("replaces an existing emitter that falls short", () => {
    const r = sizeRoomEmitter({
      roomDemandW: 1000,
      flowTempC: 45,
      roomTempC: 21,
      existingRatedOutputW: 2000,
    });
    expect(r.status).toBe("replacement");
    expect(r.meetsDemand).toBe(true);
    expect(r.requiredRatedOutputW).toBeCloseTo(2995.6, 0);
  });

  it("specifies a new emitter where none exists", () => {
    const r = sizeRoomEmitter({ roomDemandW: 1000, flowTempC: 45, roomTempC: 21 });
    expect(r.status).toBe("new");
    expect(r.providedOutputW).toBe(1000);
  });

  it("flags an unmet replacement when conditions cannot deliver heat", () => {
    const r = sizeRoomEmitter({
      roomDemandW: 1000,
      flowTempC: 40,
      roomTempC: 40,
      existingRatedOutputW: 5000,
    });
    expect(r.status).toBe("replacement");
    expect(r.meetsDemand).toBe(false);
  });
});
