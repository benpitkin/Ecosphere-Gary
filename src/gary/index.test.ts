import { describe, it, expect } from "vitest";
import * as gary from "@/gary";

/**
 * Locks Gary's public surface — the single import point a host app (Core) uses.
 * If a rename or move breaks the barrel, this fails loudly.
 */
describe("@/gary public surface", () => {
  it("exposes the three orchestrators and the ingestion parser", () => {
    expect(typeof gary.designOptions).toBe("function");
    expect(typeof gary.triage).toBe("function");
    expect(typeof gary.solarPreDesign).toBe("function");
    expect(typeof gary.sizeSolar).toBe("function");
    expect(typeof gary.parseSprucePdf).toBe("function");
  });

  it("exposes the contract parsers", () => {
    expect(typeof gary.parseSurveyObject).toBe("function");
    expect(typeof gary.parseDesignResult).toBe("function");
    expect(typeof gary.parseTriageInput).toBe("function");
    expect(typeof gary.parseSolarEnquiry).toBe("function");
  });

  it("exposes integration + config helpers", () => {
    expect(typeof gary.createOpenSolarClient).toBe("function");
    expect(typeof gary.isOpenSolarConfigured).toBe("function");
    expect(typeof gary.isSolarReasoningConfigured).toBe("function");
    expect(typeof gary.requireApiKey).toBe("function");
    expect(gary.OPTION_COUNT).toBe(3);
  });

  it("runs the engine end-to-end through the barrel import", () => {
    const survey = gary.parseSurveyObject({
      version: gary.SURVEY_OBJECT_VERSION,
      source: "pdf",
      property: { address: "1 Test St" },
      designConditions: { externalDesignTempC: -2, internalDesignTempC: 21 },
      wholeHouse: { heatLossW: 5000 },
      rooms: [],
      flags: [],
    });
    const result = gary.designOptions(survey);
    expect(result.options).toHaveLength(3);
  });
});
