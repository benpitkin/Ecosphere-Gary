import { describe, it, expect } from "vitest";
import { designOptions, NotImplementedError } from "@/lib/engine";
import { resolveModel } from "@/lib/reasoning";
import { REASONING } from "@/config/decisions";
import { SURVEY_OBJECT_VERSION, type SurveyObject } from "@/contracts/survey";

const survey: SurveyObject = {
  version: SURVEY_OBJECT_VERSION,
  source: "pdf",
  property: { address: "3 Orchard Close" },
  designConditions: { externalDesignTempC: -2.2, internalDesignTempC: 21 },
  wholeHouse: { heatLossW: 5650 },
  rooms: [],
  flags: [],
};

describe("calc engine (Phase 3 boundary)", () => {
  it("throws NotImplementedError until the engine is built", () => {
    expect(() => designOptions(survey)).toThrow(NotImplementedError);
  });
});

describe("reasoning layer model resolution", () => {
  it("defaults to the configured model when ANTHROPIC_MODEL is unset", () => {
    const original = process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_MODEL;
    expect(resolveModel()).toBe(REASONING.defaultModel);
    if (original !== undefined) process.env.ANTHROPIC_MODEL = original;
  });

  it("honours an explicit ANTHROPIC_MODEL override", () => {
    const original = process.env.ANTHROPIC_MODEL;
    process.env.ANTHROPIC_MODEL = "some-other-model";
    expect(resolveModel()).toBe("some-other-model");
    if (original === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = original;
  });
});
