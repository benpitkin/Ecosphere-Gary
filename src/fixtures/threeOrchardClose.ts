import {
  SURVEY_OBJECT_VERSION,
  parseSurveyObject,
  type SurveyObject,
} from "@/contracts/survey";

/**
 * Golden fixture — 3 Orchard Close, Ottery St. Mary.
 * ==================================================
 *
 * Hand-encoded from the heat loss report PDF (`fixtures/3-orchard-close.pdf`).
 * This is the normalised `SurveyObject` the Phase 2 parser must eventually
 * reproduce, and the reference the deterministic engine is validated against.
 *
 * Notable real-world shapes captured here (CLAUDE.md "PDF parser gotchas"):
 *  - two "Hall/Landing" rooms keyed by name + floor;
 *  - a negative-contribution room exists at element level (kept as-is);
 *  - merged zone "Bed & Ensuite + Bedroom 1" is split into its two rooms here;
 *  - multi-emitter room (Living/Lounge);
 *  - UFH rooms (Kitchen, Utility, Cloaks/WC) have no surveyed radiator;
 *  - the sound assessment is Incomplete → captured as a flag, not assumed done.
 *
 * `emitters[]` here are the *existing* radiators as surveyed (status "keep" =
 * currently installed), each with its output at the 45 °C design condition as
 * stated in the report. The proposed New/Replace/Remove design is engine output.
 */

const rawSurvey = {
  version: SURVEY_OBJECT_VERSION,
  source: "pdf",
  property: {
    address: "3 Orchard Close, Ottery St. Mary, EX11 1HT",
    propertyType: "house",
  },
  designConditions: {
    externalDesignTempC: -1.5,
    internalDesignTempC: 21,
  },
  wholeHouse: { heatLossW: 5650, floorAreaM2: 206 },
  rooms: [
    // --- Ground floor ---
    { name: "Cloaks/WC", floor: "ground", roomTempC: 18, heatLossW: 73, floorAreaM2: 1.9 },
    {
      name: "Hall/Landing",
      floor: "ground",
      roomTempC: 18,
      heatLossW: 402,
      floorAreaM2: 15.0,
      emitters: [
        { type: "radiator", status: "keep", description: "Type 22 (K2) 700x1200 mm", outputW: 870 },
      ],
    },
    { name: "Kitchen", floor: "ground", roomTempC: 18, heatLossW: 1107, floorAreaM2: 52.0 },
    {
      name: "Living/Lounge",
      floor: "ground",
      roomTempC: 21,
      heatLossW: 879,
      floorAreaM2: 18.5,
      emitters: [
        { type: "radiator", status: "keep", description: "Type 21 (P+) 600x1200 mm", outputW: 511 },
        { type: "radiator", status: "keep", description: "Type 21 (P+) 600x800 mm", outputW: 341 },
      ],
    },
    {
      name: "Study",
      floor: "ground",
      roomTempC: 21,
      heatLossW: 505,
      floorAreaM2: 12.5,
      emitters: [
        { type: "radiator", status: "keep", description: "Type 21 (P+) 600x1000 mm", outputW: 426 },
      ],
    },
    { name: "Utility", floor: "ground", roomTempC: 18, heatLossW: 187, floorAreaM2: 9.3 },
    // --- First floor ---
    { name: "Bath/Shower", floor: "first", roomTempC: 22, heatLossW: 238, floorAreaM2: 5.2 },
    { name: "Bed & Ensuite", floor: "first", roomTempC: 21, heatLossW: 225, floorAreaM2: 7.5 },
    { name: "Bedroom 1", floor: "first", roomTempC: 18, heatLossW: 381, floorAreaM2: 19.2 },
    {
      name: "Bedroom 2",
      floor: "first",
      roomTempC: 18,
      heatLossW: 665,
      floorAreaM2: 16.8,
      emitters: [
        { type: "radiator", status: "keep", description: "Type 21 (P+) 600x1100 mm", outputW: 557 },
      ],
    },
    { name: "Bedroom 3", floor: "first", roomTempC: 18, heatLossW: 283, floorAreaM2: 15.6 },
    {
      name: "Bedroom 4",
      floor: "first",
      roomTempC: 18,
      heatLossW: 319,
      floorAreaM2: 13.3,
      emitters: [
        { type: "radiator", status: "keep", description: "Type 21 (P+) 600x600 mm", outputW: 304 },
      ],
    },
    { name: "Hall/Landing", floor: "first", roomTempC: 18, heatLossW: 390, floorAreaM2: 18.8 },
  ],
  heatPump: {
    manufacturer: "Vaillant",
    model: "aroTHERM pro 7kW",
    ratedCapacityKw: 7,
  },
  flags: [
    {
      code: "sound_assessment_incomplete",
      message: "MCS 020a sound assessment is Incomplete (0 dB at 0 m) — must be completed before sign-off.",
      severity: "warning",
    },
  ],
};

/** Parsed + validated at import — the fixture is guaranteed contract-valid. */
export const threeOrchardCloseSurvey: SurveyObject = parseSurveyObject(rawSurvey);

/**
 * Existing Type 21 (P+), 600 mm-high radiators with their reported output at the
 * 45 °C / ΔT5 design condition, used to validate the EN442 correction across
 * rooms at different set-point temperatures.
 */
export const REPORTED_TYPE21_P_600H = [
  { room: "Study", roomTempC: 21, lengthMm: 1000, outputW45: 426 },
  { room: "Living/Lounge", roomTempC: 21, lengthMm: 1200, outputW45: 511 },
  { room: "Living/Lounge", roomTempC: 21, lengthMm: 800, outputW45: 341 },
  { room: "Bedroom 2", roomTempC: 18, lengthMm: 1100, outputW45: 557 },
  { room: "Bedroom 4", roomTempC: 18, lengthMm: 600, outputW45: 304 },
] as const;

/** Heat-pump figures the report states at the design condition (-1.5 °C). */
export const EXPECTED_HEAT_PUMP = {
  designOutsideTempC: -1.5,
  capacityAt45Kw: 7.54,
  coverRatio: 1.33,
  scopByFlow: { 40: 4.43, 45: 4.13, 50: 3.82 },
} as const;

/** MCS031 (Issue 4.0) outputs from the report — reference for the future calculator. */
export const EXPECTED_MCS031 = {
  heatingKwh: 12165,
  dhwKwh: 2938,
  spf: 3.4,
  floorAreaM2: 206,
} as const;
