import { describe, it, expect } from "vitest";
import { designOptions } from "@/gary/lib/engine";
import { resolveModel } from "@/gary/lib/reasoning";
import { REASONING } from "@/gary/config/decisions";
import { SURVEY_OBJECT_VERSION, type SurveyObject } from "@/gary/contracts/survey";

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
  it("produces the three fixed options for a minimal survey", () => {
    const result = designOptions(survey);
    expect(result.options.map((o) => [o.key, o.flowTempC])).toEqual([
      ["eco", 40],
      ["sweet_spot", 45],
      ["budget", 50],
    ]);
    expect(result.recommended).toBe("sweet_spot");
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
