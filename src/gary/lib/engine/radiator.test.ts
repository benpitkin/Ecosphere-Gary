import { describe, it, expect } from "vitest";
import { selectRadiator, type RadiatorModel } from "@/gary/lib/engine/radiator";

// Synthetic Stelrad-style catalogue (stand-in for manufacturer data).
const catalogue: RadiatorModel[] = [
  { specification: "Stelrad Compact K2 600x800", ratedOutputW: 1500 },
  { specification: "Stelrad Compact K2 600x1200", ratedOutputW: 2250 },
  { specification: "Stelrad Compact K3 600x1200", ratedOutputW: 3200 },
];

describe("selectRadiator", () => {
  it("picks the smallest radiator that meets the requirement", () => {
    const r = selectRadiator(2000, catalogue)!;
    expect(r.specification).toBe("Stelrad Compact K2 600x1200"); // 2250 ≥ 2000
    expect(r.meetsRequirement).toBe(true);
  });

  it("returns an exact-fit boundary correctly", () => {
    const r = selectRadiator(2250, catalogue)!;
    expect(r.ratedOutputW).toBe(2250);
    expect(r.meetsRequirement).toBe(true);
  });

  it("returns the largest and flags when nothing is big enough", () => {
    const r = selectRadiator(5000, catalogue)!;
    expect(r.specification).toBe("Stelrad Compact K3 600x1200");
    expect(r.meetsRequirement).toBe(false);
  });

  it("chooses the smallest radiator for non-positive requirement", () => {
    const r = selectRadiator(0, catalogue)!;
    expect(r.ratedOutputW).toBe(1500);
    expect(r.meetsRequirement).toBe(true);
  });

  it("returns null for an empty catalogue", () => {
    expect(selectRadiator(1000, [])).toBeNull();
  });
});
