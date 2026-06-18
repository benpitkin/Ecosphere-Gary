import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSprucePdf } from "@/lib/ingestion/sprucePdf";
import { threeOrchardCloseSurvey } from "@/fixtures/threeOrchardClose";
import type { SurveyObject } from "@/contracts/survey";

// Core room fields the parser is responsible for (emitter extraction is a
// follow-up, so it's excluded from the comparison).
const coreRooms = (s: SurveyObject) =>
  s.rooms.map((r) => ({
    name: r.name,
    floor: r.floor,
    roomTempC: r.roomTempC,
    heatLossW: r.heatLossW,
    floorAreaM2: r.floorAreaM2,
  }));

describe("Spruce PDF parser vs the 3 Orchard Close golden fixture", () => {
  let parsed: SurveyObject;

  beforeAll(async () => {
    const buf = readFileSync(resolve(__dirname, "../../../fixtures/3-orchard-close.pdf"));
    parsed = await parseSprucePdf(buf);
  });

  it("extracts the design conditions and whole-house figures", () => {
    expect(parsed.designConditions.externalDesignTempC).toBe(-1.5);
    expect(parsed.wholeHouse.heatLossW).toBe(5650);
    expect(parsed.wholeHouse.floorAreaM2).toBe(206);
  });

  it("extracts the surveyed heat pump", () => {
    expect(parsed.heatPump?.manufacturer).toBe("Vaillant");
    expect(parsed.heatPump?.model).toContain("aroTHERM pro 7kW");
    expect(parsed.heatPump?.ratedCapacityKw).toBe(7);
  });

  it("reproduces all 13 rooms with floors, temps, losses and areas", () => {
    expect(parsed.rooms).toHaveLength(13);
    expect(coreRooms(parsed)).toEqual(coreRooms(threeOrchardCloseSurvey));
  });

  it("assigns the two Hall/Landing rooms to the correct floors", () => {
    const halls = parsed.rooms.filter((r) => r.name === "Hall/Landing");
    expect(halls).toHaveLength(2);
    expect(halls.find((r) => r.floor === "ground")?.heatLossW).toBe(402);
    expect(halls.find((r) => r.floor === "first")?.heatLossW).toBe(390);
  });

  it("flags the incomplete sound assessment", () => {
    expect(parsed.flags.some((f) => f.code === "sound_assessment_incomplete")).toBe(true);
  });

  it("ground-floor room losses sum to the stated 3153 W subtotal", () => {
    const ground = parsed.rooms
      .filter((r) => r.floor === "ground")
      .reduce((a, r) => a + r.heatLossW, 0);
    expect(ground).toBe(3153);
  });
});
