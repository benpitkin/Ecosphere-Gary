import { describe, it, expect } from "vitest";
import { designOptions } from "@/lib/engine";
import { provisionalMcs031Calculator, type Mcs031Calculator } from "@/lib/engine/mcs031";
import type { RadiatorModel } from "@/lib/engine/radiator";
import { threeOrchardCloseSurvey, EXPECTED_HEAT_PUMP } from "@/fixtures/threeOrchardClose";
import type { DesignOption } from "@/contracts/design";

const byKey = (result: { options: DesignOption[] }, key: string) =>
  result.options.find((o) => o.key === key)!;
const emitterFor = (option: DesignOption, room: string) =>
  option.emitters.filter((e) => e.room === room);

describe("designOptions against the 3 Orchard Close golden fixture", () => {
  const result = designOptions(threeOrchardCloseSurvey);

  it("emits exactly the three fixed options in order, recommending the sweet spot", () => {
    expect(result.options.map((o) => [o.key, o.flowTempC])).toEqual([
      ["eco", 40],
      ["sweet_spot", 45],
      ["budget", 50],
    ]);
    expect(result.options.every((o) => o.deltaTC === 5)).toBe(true);
    expect(result.recommended).toBe("sweet_spot");
  });

  it("matches the heat pump and reads SCOP per flow temp (report figures)", () => {
    const sweet = byKey(result, "sweet_spot");
    expect(sweet.heatPump.manufacturer).toBe("Vaillant");
    expect(sweet.heatPump.capacityAtDesignKw).toBeCloseTo(EXPECTED_HEAT_PUMP.capacityAt45Kw, 1);
    expect(sweet.heatPump.coverRatio).toBe(EXPECTED_HEAT_PUMP.coverRatio);
    expect(byKey(result, "eco").heatPump.scop).toBe(EXPECTED_HEAT_PUMP.scopByFlow[40]);
    expect(byKey(result, "sweet_spot").heatPump.scop).toBe(EXPECTED_HEAT_PUMP.scopByFlow[45]);
    expect(byKey(result, "budget").heatPump.scop).toBe(EXPECTED_HEAT_PUMP.scopByFlow[50]);
  });

  it("keeps an emitter that already meets demand and replaces one that doesn't", () => {
    const sweet = byKey(result, "sweet_spot");
    // Hall/Landing (ground): existing 870 W @ 45 vs 402 W demand → keep.
    const hall = emitterFor(sweet, "Hall/Landing").filter((e) => e.floor === "ground");
    expect(hall).toHaveLength(1);
    expect(hall[0].status).toBe("keep");
    // Living/Lounge: existing 852 W @ 45 vs 879 W demand (97 %) → replacement.
    expect(emitterFor(sweet, "Living/Lounge").every((e) => e.status === "replacement")).toBe(true);
    // Study: existing 426 W @ 45 vs 505 W demand (84 %) → replacement.
    expect(emitterFor(sweet, "Study")[0].status).toBe("replacement");
  });

  it("shows the flow-temp trade-off: a higher flow lets an existing emitter be kept", () => {
    // Living/Lounge can't be kept at 45 °C but can at 50 °C (smaller emitter suffices).
    expect(emitterFor(byKey(result, "sweet_spot"), "Living/Lounge")[0].status).toBe("replacement");
    expect(emitterFor(byKey(result, "budget"), "Living/Lounge").every((e) => e.status === "keep")).toBe(true);
  });

  it("proposes radiators for the UFH rooms but flags that UFH is not modelled", () => {
    // Kitchen has no surveyed emitter → engine proposes a (new) radiator …
    const kitchen = emitterFor(byKey(result, "sweet_spot"), "Kitchen");
    expect(kitchen[0]?.status).toBe("new");
    // … and surfaces the gap rather than silently designing UFH.
    expect(result.reviewFlags.some((f) => f.code === "ufh_not_modelled")).toBe(true);
  });

  it("raises blocker flags for the missing MCS031 method and radiator catalogue", () => {
    const blockers = result.reviewFlags.filter((f) => f.severity === "blocker").map((f) => f.code);
    expect(blockers).toContain("mcs031_provisional");
    expect(blockers).toContain("stelrad_catalogue_pending");
  });

  it("carries the ingestion sound-assessment flag through to review", () => {
    expect(result.reviewFlags.some((f) => f.code === "sound_assessment_incomplete")).toBe(true);
  });

  it("produces a provisional MCS031 estimate that improves as flow temp drops", () => {
    const eco = byKey(result, "eco").performance;
    const budget = byKey(result, "budget").performance;
    // Lower flow temp → higher SPF → lower running cost (the whole trade-off).
    expect(eco.spf).toBeGreaterThan(budget.spf);
    expect(eco.annualRunningCostGbp).toBeLessThan(budget.annualRunningCostGbp);
    expect(eco.annualHeatingKwh).toBeGreaterThan(0);
  });

  it("records an auditable trace", () => {
    const steps = result.auditTrace.map((a) => a.step);
    expect(steps).toContain("design_heat_loss");
    expect(steps).toContain("option_sweet_spot");
    expect(steps).toContain("mcs031_method");
  });
});

describe("designOptions with injected dependencies (real data slots in)", () => {
  // A representative catalogue (NOT real Stelrad data — for wiring tests only).
  const catalogue: RadiatorModel[] = [
    { specification: "Type 11 K1 600x1000", ratedOutputW: 1000 },
    { specification: "Type 21 P+ 600x1200", ratedOutputW: 2000 },
    { specification: "Type 22 K2 600x1400", ratedOutputW: 3200 },
    { specification: "Type 33 K3 600x1600", ratedOutputW: 5200 },
  ];

  it("selects concrete radiator models when a catalogue is supplied", () => {
    const result = designOptions(threeOrchardCloseSurvey, { radiatorCatalogue: catalogue });
    const study = result.options[1].emitters.find((e) => e.room === "Study" && e.status !== "keep");
    expect(study?.specification).toMatch(/^Stelrad Type/);
    expect(result.reviewFlags.some((f) => f.code === "stelrad_catalogue_pending")).toBe(false);
  });

  it("drops the provisional-MCS031 blocker when a compliant calculator is injected", () => {
    const compliant: Mcs031Calculator = {
      method: "MCS031:4.0-test",
      compliant: true,
      compute: (i) => provisionalMcs031Calculator.compute(i),
    };
    const result = designOptions(threeOrchardCloseSurvey, { mcs031: compliant });
    expect(result.reviewFlags.some((f) => f.code === "mcs031_provisional")).toBe(false);
  });
});
