import { describe, it, expect } from "vitest";
import { runReviewChecks } from "@/gary/lib/review/checks";
import { parseReviewInput, type ReviewInput } from "@/gary/contracts/review";

const input = (over: Partial<ReviewInput["design"]> = {}, quote?: ReviewInput["quote"]): ReviewInput =>
  parseReviewInput({
    design: {
      wholeHouseHeatLossKw: 5.65,
      flowTempC: 45,
      heatPump: { manufacturer: "Vaillant", model: "aroTHERM pro 7kW", capacityAtDesignKw: 7.54, scop: 4.13 },
      mcs031Present: true,
      rooms: [],
      ...over,
    },
    ...(quote ? { quote } : {}),
  });

describe("design & quote review checks", () => {
  it("passes a sound design with cover, emitters met and MCS031 present", () => {
    const r = runReviewChecks(
      input({
        rooms: [{ name: "Lounge", heatLossW: 800, roomTempC: 21, emitters: [{ type: "radiator", status: "new", outputW: 900 }] }],
      }),
    );
    expect(r.verdict).toBe("pass");
    expect(r.findings).toHaveLength(0);
    expect(r.metrics.coverRatio).toBe(1.33);
  });

  it("fails an undersized heat pump (cover < 100%)", () => {
    const r = runReviewChecks(input({ heatPump: { capacityAtDesignKw: 4.5 }, wholeHouseHeatLossKw: 5.65 }));
    expect(r.verdict).toBe("fail");
    expect(r.findings.some((f) => f.code === "heat_pump_undersized" && f.severity === "blocker")).toBe(true);
  });

  it("flags an undersized room emitter", () => {
    const r = runReviewChecks(
      input({
        rooms: [{ name: "Study", heatLossW: 600, roomTempC: 21, emitters: [{ type: "radiator", status: "new", outputW: 400 }] }],
      }),
    );
    expect(r.metrics.roomsUndersized).toBe(1);
    expect(r.findings.some((f) => f.code === "emitter_undersized")).toBe(true);
  });

  it("converts a ΔT50 rating to conditions when flow temp is known", () => {
    // A ΔT50-rated emitter big enough at ΔT50 may fall short at a 45 °C flow.
    const r = runReviewChecks(
      input({
        flowTempC: 45,
        rooms: [{ name: "Hall", heatLossW: 800, roomTempC: 21, emitters: [{ type: "radiator", status: "new", ratedOutputW50: 1000 }] }],
      }),
    );
    // 1000 W @ ΔT50 corrects down at 45 °C/ΔT5 → well under 800 W → undersized.
    expect(r.findings.some((f) => f.code === "emitter_undersized")).toBe(true);
  });

  it("blocks when MCS031 is missing", () => {
    const r = runReviewChecks(input({ mcs031Present: false }));
    expect(r.verdict).toBe("fail");
    expect(r.findings.some((f) => f.code === "mcs031_missing")).toBe(true);
  });

  it("checks quote coverage against the design", () => {
    const r = runReviewChecks(
      input(
        {
          hasDhw: true,
          rooms: [
            { name: "A", heatLossW: 500, emitters: [{ type: "radiator", status: "new", outputW: 600 }] },
            { name: "B", heatLossW: 500, emitters: [{ type: "radiator", status: "replacement", outputW: 600 }] },
          ],
        },
        { lineItems: [{ description: "Labour", quantity: 1 }] },
      ),
    );
    const codes = r.findings.map((f) => f.code);
    expect(codes).toContain("quote_missing_heat_pump");
    expect(codes).toContain("quote_missing_cylinder");
    expect(codes).toContain("quote_radiators_short");
  });

  it("is satisfied when the quote covers the design", () => {
    const r = runReviewChecks(
      input(
        {
          hasDhw: true,
          rooms: [{ name: "A", heatLossW: 500, emitters: [{ type: "radiator", status: "new", outputW: 600 }] }],
        },
        {
          lineItems: [
            { description: "Vaillant aroTHERM 7kW heat pump", quantity: 1 },
            { description: "200L hot water cylinder", quantity: 1 },
            { description: "Stelrad radiator", quantity: 1 },
          ],
        },
      ),
    );
    const codes = r.findings.map((f) => f.code);
    expect(codes).not.toContain("quote_missing_heat_pump");
    expect(codes).not.toContain("quote_missing_cylinder");
    expect(codes).not.toContain("quote_radiators_short");
  });
});
