import { describe, it, expect } from "vitest";
import { STELRAD_COMPACT_CATALOGUE } from "@/lib/engine/catalog/stelradCompact";

describe("Stelrad Compact catalogue (ΔT50)", () => {
  it("is a non-trivial catalogue of typed, positive-output models", () => {
    expect(STELRAD_COMPACT_CATALOGUE.length).toBeGreaterThan(100);
    expect(STELRAD_COMPACT_CATALOGUE.every((m) => m.ratedOutputW > 0)).toBe(true);
    expect(STELRAD_COMPACT_CATALOGUE.every((m) => /^Stelrad Compact Type/.test(m.specification))).toBe(true);
  });

  it("matches the certified W/m × length for known models", () => {
    // P+ 600 high = 1345 W/m → 1000 mm = 1345 W; K2 600 high = 1732 W/m → 1200 mm ≈ 2078 W.
    const pPlus = STELRAD_COMPACT_CATALOGUE.find(
      (m) => m.specification === "Stelrad Compact Type 21 (P+) 600x1000 mm",
    );
    const k2 = STELRAD_COMPACT_CATALOGUE.find(
      (m) => m.specification === "Stelrad Compact Type 22 (K2) 600x1200 mm",
    );
    expect(pPlus?.ratedOutputW).toBe(1345);
    expect(k2?.ratedOutputW).toBe(2078);
  });
});
