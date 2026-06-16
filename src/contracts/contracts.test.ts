import { describe, it, expect } from "vitest";
import {
  SurveyObject,
  SURVEY_OBJECT_VERSION,
  parseSurveyObject,
} from "@/contracts/survey";
import {
  DesignResult,
  DESIGN_RESULT_VERSION,
  parseDesignResult,
} from "@/contracts/design";

const validSurvey = {
  version: SURVEY_OBJECT_VERSION,
  source: "pdf" as const,
  property: { address: "3 Orchard Close, Ottery St. Mary" },
  designConditions: { externalDesignTempC: -2.2, internalDesignTempC: 21 },
  wholeHouse: { heatLossW: 5650 },
  rooms: [
    {
      name: "Living/Lounge",
      floor: "ground",
      heatLossW: 1200,
      emitters: [{ type: "radiator" as const, status: "keep" as const }],
    },
    // Negative element heat loss must be accepted, not clamped.
    { name: "Hall/Landing", floor: "first", heatLossW: -43 },
  ],
};

describe("SurveyObject contract", () => {
  it("accepts a well-formed survey (incl. negative room heat loss)", () => {
    const parsed = parseSurveyObject(validSurvey);
    expect(parsed.wholeHouse.heatLossW).toBe(5650);
    expect(parsed.rooms[1].heatLossW).toBe(-43);
    // defaults applied
    expect(parsed.rooms[0].merged).toBe(false);
    expect(parsed.flags).toEqual([]);
  });

  it("rejects a survey missing required fields", () => {
    const bad = { ...validSurvey, wholeHouse: {} };
    expect(SurveyObject.safeParse(bad).success).toBe(false);
  });

  it("rejects a wrong version literal", () => {
    const bad = { ...validSurvey, version: 999 };
    expect(SurveyObject.safeParse(bad).success).toBe(false);
  });
});

const validDesignOption = (
  key: "eco" | "sweet_spot" | "budget",
  flowTempC: 40 | 45 | 50,
  capitalRank: "highest" | "medium" | "lowest",
) => ({
  key,
  flowTempC,
  deltaTC: 5,
  emitters: [],
  heatPump: {
    manufacturer: "Vaillant",
    model: "aroTHERM pro 7kW",
    capacityAtDesignKw: 7.54,
    coverRatio: 1.33,
    scop: 4.13,
  },
  performance: {
    spf: 4.13,
    annualHeatingKwh: 8000,
    annualDhwKwh: 2000,
    annualRunningCostGbp: 850,
    annualCarbonKgCo2e: 400,
  },
  capitalRank,
  justification: null,
});

const validResult = {
  version: DESIGN_RESULT_VERSION,
  options: [
    validDesignOption("eco", 40, "highest"),
    validDesignOption("sweet_spot", 45, "medium"),
    validDesignOption("budget", 50, "lowest"),
  ],
  recommended: "sweet_spot" as const,
};

describe("DesignResult contract", () => {
  it("accepts exactly three well-formed options", () => {
    const parsed = parseDesignResult(validResult);
    expect(parsed.options).toHaveLength(3);
    expect(parsed.recommended).toBe("sweet_spot");
    expect(parsed.reviewFlags).toEqual([]);
  });

  it("requires exactly three options", () => {
    const bad = { ...validResult, options: validResult.options.slice(0, 2) };
    expect(DesignResult.safeParse(bad).success).toBe(false);
  });

  it("rejects an out-of-range flow temperature", () => {
    const bad = {
      ...validResult,
      options: [
        { ...validDesignOption("eco", 40, "highest"), flowTempC: 55 },
        validDesignOption("sweet_spot", 45, "medium"),
        validDesignOption("budget", 50, "lowest"),
      ],
    };
    expect(DesignResult.safeParse(bad).success).toBe(false);
  });
});
