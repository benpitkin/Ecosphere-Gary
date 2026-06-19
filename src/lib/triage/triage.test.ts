import { describe, it, expect } from "vitest";
import { triage, estimateHeatLossKw, suggestNominalKw } from "@/lib/triage";
import { parseTriageInput } from "@/contracts/triage";

const base = (over: Record<string, unknown> = {}) =>
  parseTriageInput({ address: "Somewhere, EX1 1AA", ...over });

describe("triage estimate helpers", () => {
  it("scales heat loss with floor area and wall type", () => {
    const solid = estimateHeatLossKw(100, "solid", "double", undefined);
    const cavity = estimateHeatLossKw(100, "cavity_filled", "double", undefined);
    expect(solid.high).toBeGreaterThan(cavity.high);
  });

  it("picks the smallest nominal HP size that covers the estimate", () => {
    expect(suggestNominalKw(6.2)).toBe(7);
    expect(suggestNominalKw(7)).toBe(7);
    expect(suggestNominalKw(8.1)).toBe(8.5);
  });
});

describe("triage decisions", () => {
  it("recommends a survey for a clean, well-described property", () => {
    const r = triage(
      base({
        property: { floorAreaM2: 120, wallType: "cavity_filled", glazing: "double", mainFuel: "mains_gas" },
        answers: { ownerOccupier: "yes", listedOrConservation: "no", spaceForUnitAndCylinder: "yes" },
      }),
    );
    expect(r.nextAction).toBe("book_survey");
    expect(r.suitability).toBe("good");
    expect(r.indicativeHeatPumpKw).not.toBeNull();
    expect(r.confidence).toBe("high");
  });

  it("treats no cylinder/unit space as a blocker → human follow-up", () => {
    const r = triage(
      base({
        property: { floorAreaM2: 120, wallType: "cavity_filled" },
        answers: { spaceForUnitAndCylinder: "no" },
      }),
    );
    expect(r.flags.some((f) => f.code === "no_space" && f.severity === "blocker")).toBe(true);
    expect(r.nextAction).toBe("human_follow_up");
    expect(r.suitability).toBe("unlikely");
  });

  it("flags complexity (solid walls / listed) → promising_complex", () => {
    const r = triage(
      base({
        property: { floorAreaM2: 150, wallType: "solid", mainFuel: "oil" },
        answers: { ownerOccupier: "yes", listedOrConservation: "yes", spaceForUnitAndCylinder: "yes" },
      }),
    );
    expect(r.nextAction).toBe("human_follow_up");
    expect(r.suitability).toBe("promising_complex");
    expect(r.flags.some((f) => f.code === "solid_walls")).toBe(true);
    expect(r.flags.some((f) => f.code === "off_gas")).toBe(true);
  });

  it("asks for more info when floor area is missing", () => {
    const r = triage(base({ property: { wallType: "cavity_filled" } }));
    expect(r.nextAction).toBe("gather_info");
    expect(r.suitability).toBe("unclear");
    expect(r.indicativeHeatPumpKw).toBeNull();
  });

  it("always returns plain-English basis for the judgement", () => {
    const r = triage(base({ property: { floorAreaM2: 100 } }));
    expect(r.basis.length).toBeGreaterThan(0);
  });
});
