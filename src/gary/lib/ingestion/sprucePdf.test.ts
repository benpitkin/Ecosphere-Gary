import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSprucePdf } from "@/gary/lib/ingestion/sprucePdf";
import { threeOrchardCloseSurvey } from "@/gary/fixtures/threeOrchardClose";
import type { SurveyObject } from "@/gary/contracts/survey";

// Core heat-loss room fields (compared separately from emitters for clearer
// failures).
const coreRooms = (s: SurveyObject) =>
  s.rooms.map((r) => ({
    name: r.name,
    floor: r.floor,
    roomTempC: r.roomTempC,
    heatLossW: r.heatLossW,
    floorAreaM2: r.floorAreaM2,
  }));

// Existing emitters keyed to their room (name + floor), for an order-independent
// comparison against the fixture.
const roomEmitters = (s: SurveyObject) =>
  s.rooms.map((r) => ({ name: r.name, floor: r.floor, emitters: r.emitters }));

describe("Spruce PDF parser vs the 3 Orchard Close golden fixture", () => {
  let parsed: SurveyObject;

  beforeAll(async () => {
    const buf = readFileSync(resolve(__dirname, "../../../../fixtures/3-orchard-close.pdf"));
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

  it("extracts each room's existing emitters and attaches them to the right room", () => {
    expect(roomEmitters(parsed)).toEqual(roomEmitters(threeOrchardCloseSurvey));
  });

  it("finds the 6 existing radiators across the 5 emitter rooms", () => {
    const all = parsed.rooms.flatMap((r) => r.emitters);
    expect(all).toHaveLength(6);
    expect(all.every((e) => e.type === "radiator" && e.status === "keep")).toBe(true);
    // Spot-check the multi-emitter Living/Lounge (Keep + Keep) and a UFH room.
    const lounge = parsed.rooms.find((r) => r.name === "Living/Lounge");
    expect(lounge?.emitters.map((e) => e.outputW)).toEqual([511, 341]);
    expect(parsed.rooms.find((r) => r.name === "Kitchen")?.emitters).toEqual([]);
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
