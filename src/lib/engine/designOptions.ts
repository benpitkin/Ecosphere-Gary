import type { SurveyObject } from "@/contracts/survey";
import {
  parseDesignResult,
  type AuditEntry,
  type DesignedEmitter,
  type DesignOption,
  type DesignResult,
  type ReviewFlag,
  type SelectedHeatPump,
} from "@/contracts/design";
import {
  DEFAULT_OPTION,
  EMITTER_SIZING,
  OPTIONS,
  TECHNICAL_DEFAULTS,
} from "@/config/decisions";
import {
  correctionFactor,
  outputAtConditionsW,
  sizeRoomEmitter,
} from "@/lib/engine/emitter";
import { selectHeatPump, type HeatPumpModel } from "@/lib/engine/heatpump";
import { selectRadiator, type RadiatorModel } from "@/lib/engine/radiator";
import { modelAt } from "@/lib/engine/catalog/vaillantAroThermPro7kw";
import { STELRAD_COMPACT_CATALOGUE } from "@/lib/engine/catalog/stelradCompact";
import {
  provisionalMcs031Calculator,
  type Mcs031Calculator,
} from "@/lib/engine/mcs031";

/**
 * designOptions — the deterministic spine end-to-end (Phase 3).
 * ============================================================
 *
 * SurveyObject in → DesignResult out. For each of the three fixed options
 * (eco 40 / sweet_spot 45 / budget 50 °C, ΔT 5) it:
 *   1. sizes each room's emitter to 100 % of room demand at the option's
 *      conditions, keeping existing emitters that already meet demand;
 *   2. turns each required size into a concrete radiator (from an injected
 *      Stelrad catalogue) or, until that catalogue is supplied, into the exact
 *      required ΔT50 rating with the model left "TBC";
 *   3. matches a heat pump (capacity ≥ loss) and reads its SCOP at the flow temp;
 *   4. attaches the option's MCS031 performance estimate.
 *
 * **No LLM, no I/O, no fabricated data.** The two inputs Gary doesn't yet have —
 * the Stelrad catalogue and the MCS031 Issue 4.0 method — are injected
 * dependencies. Without them the engine still runs (so the pipeline is testable),
 * but it specifies required ratings rather than inventing model numbers, and it
 * raises blocker review flags so the output is never mistaken for sign-off-ready.
 *
 * Per-option `justification` is left null — that's the Claude reasoning layer
 * (Phase 4), which runs *after* the maths is proven.
 */

/** The flow temp at which a survey states an existing emitter's output (Spruce: 45 °C). */
const SURVEY_EMITTER_FLOW_C = 45;

export interface DesignEngineDeps {
  /**
   * Concrete radiator catalogue. Defaults to the Stelrad Compact catalogue (the
   * EcoSphere standard). Pass an empty array to force the engine to specify the
   * required ΔT50 rating with the model left "TBC" (+ a blocker flag) instead.
   */
  radiatorCatalogue?: RadiatorModel[];
  /**
   * Heat-pump candidates evaluated at the site design ambient. Omit → the
   * Vaillant aroTHERM pro 7 kW at the survey's external design temperature.
   */
  heatPumpCandidates?: HeatPumpModel[];
  /** MCS031 calculator. Omit → provisional placeholder (flagged non-compliant). */
  mcs031?: Mcs031Calculator;
}

const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export function designOptions(
  survey: SurveyObject,
  deps: DesignEngineDeps = {},
): DesignResult {
  const { externalDesignTempC, internalDesignTempC } = survey.designConditions;
  const designHeatLossKw = survey.wholeHouse.heatLossW / 1000;

  const catalogue = deps.radiatorCatalogue ?? STELRAD_COMPACT_CATALOGUE;
  const haveCatalogue = catalogue.length > 0;
  const candidates = deps.heatPumpCandidates ?? [modelAt(externalDesignTempC)];
  const mcs031 = deps.mcs031 ?? provisionalMcs031Calculator;

  // Flags are de-duplicated across options (a heat-pump oversize warning that
  // recurs at every flow temp should be raised once).
  const flagMap = new Map<string, ReviewFlag>();
  const raise = (f: ReviewFlag) => flagMap.set(`${f.code}|${f.message}`, f);

  // Carry ingestion flags through — an incomplete sound assessment is exactly the
  // sort of thing the designer must see before locking an option.
  for (const f of survey.flags) {
    raise({ code: f.code, message: f.message, severity: f.severity });
  }

  if (!mcs031.compliant) {
    raise({
      code: "mcs031_provisional",
      message: `MCS031 figures use the '${mcs031.method}' placeholder, NOT the MCS 031 Issue 4.0 method — provisional only, not auditable.`,
      severity: "blocker",
    });
  }
  if (!haveCatalogue) {
    raise({
      code: "stelrad_catalogue_pending",
      message:
        "No radiator catalogue available — new/replacement emitters give the required ΔT50 rating with the model 'TBC'.",
      severity: "blocker",
    });
  }

  const audit: AuditEntry[] = [
    {
      step: "design_heat_loss",
      detail: `${survey.wholeHouse.heatLossW} W (${designHeatLossKw} kW) accepted from Spruce; not recalculated.`,
    },
    {
      step: "mcs031_method",
      detail: `${mcs031.method} (compliant: ${mcs031.compliant})`,
    },
  ];

  let roomsWithoutSurveyedEmitter = 0;

  const options = OPTIONS.map((opt): DesignOption => {
    const flowTempC = opt.flowTempC;

    // --- Heat pump match at this flow temp ---
    const match = selectHeatPump(designHeatLossKw, flowTempC, candidates);
    let heatPump: SelectedHeatPump;
    if (match) {
      heatPump = {
        manufacturer: match.manufacturer,
        model: match.model,
        capacityAtDesignKw: round(match.capacityAtDesignKw, 2),
        coverRatio: round(match.coverRatio, 2),
        scop: match.scop,
      };
      for (const mf of match.flags) raise(mf);
    } else {
      heatPump = {
        manufacturer: TECHNICAL_DEFAULTS.heatPumps[0],
        model: "no match",
        capacityAtDesignKw: 0,
        coverRatio: 0,
        scop: 0,
      };
      raise({
        code: "heat_pump_no_match",
        message: `No candidate heat pump has a performance point at ${flowTempC} °C.`,
        severity: "blocker",
      });
    }

    // --- Emitters per room ---
    const emitters: DesignedEmitter[] = [];
    let keepCount = 0;
    let replaceCount = 0;
    let newCount = 0;

    for (const room of survey.rooms) {
      const roomTempC = room.roomTempC ?? internalDesignTempC;
      const demandW = room.heatLossW;

      const surveyCf = correctionFactor(SURVEY_EMITTER_FLOW_C, roomTempC);
      const existingRads = room.emitters.filter(
        (e) => e.type === "radiator" && typeof e.outputW === "number",
      );
      const canUseExisting = existingRads.length > 0 && surveyCf > 0;
      // Back-compute each existing radiator's ΔT50 rating from its stated 45 °C
      // output, then combine for the keep/replace decision.
      const existingRatedDeltaT50 = canUseExisting
        ? existingRads.reduce((s, e) => s + e.outputW! / surveyCf, 0)
        : undefined;

      // Nothing to design: no positive demand and no existing emitter to assess.
      if (demandW <= 0 && !canUseExisting) continue;

      if (opt === OPTIONS[0] && existingRads.length === 0 && demandW > 0) {
        roomsWithoutSurveyedEmitter += 1;
      }

      const sized = sizeRoomEmitter({
        roomDemandW: demandW,
        flowTempC,
        roomTempC,
        existingRatedOutputW: existingRatedDeltaT50,
      });

      if (sized.status === "keep") {
        keepCount += 1;
        // Emit one row per kept radiator; split the room demand across them in
        // proportion to what each delivers at the option's conditions.
        const provided = existingRads.map((e) =>
          outputAtConditionsW(e.outputW! / surveyCf, flowTempC, roomTempC),
        );
        const totalProvided = provided.reduce((a, b) => a + b, 0) || 1;
        existingRads.forEach((e, i) => {
          emitters.push({
            room: room.name,
            floor: room.floor,
            type: "radiator",
            status: "keep",
            specification: e.description ?? "existing radiator",
            requiredOutputW: round(demandW * (provided[i] / totalProvided)),
            providedOutputW: round(provided[i]),
          });
        });
        continue;
      }

      // Replacement or new.
      if (sized.status === "replacement") replaceCount += 1;
      else newCount += 1;

      if (!Number.isFinite(sized.requiredRatedOutputW)) {
        emitters.push({
          room: room.name,
          floor: room.floor,
          type: "radiator",
          status: sized.status,
          specification: `INFEASIBLE at ${flowTempC} °C (mean water temp ≤ room temp ${roomTempC} °C)`,
          requiredOutputW: round(demandW),
          providedOutputW: 0,
        });
        raise({
          code: "emitter_infeasible",
          message: `${room.name} (${room.floor}) cannot be met by a radiator at ${flowTempC} °C — room set point ${roomTempC} °C is too close to the mean water temperature.`,
          severity: "blocker",
        });
        continue;
      }

      if (haveCatalogue) {
        const selection = selectRadiator(sized.requiredRatedOutputW, catalogue);
        if (selection) {
          emitters.push({
            room: room.name,
            floor: room.floor,
            type: "radiator",
            status: sized.status,
            // The catalogue's specification is the source of truth (it already
            // names the make/model); don't re-prepend the brand.
            specification: selection.specification,
            requiredOutputW: round(demandW),
            providedOutputW: round(
              outputAtConditionsW(selection.ratedOutputW, flowTempC, roomTempC),
            ),
          });
          if (!selection.meetsRequirement) {
            raise({
              code: "emitter_undersized",
              message: `${room.name} (${room.floor}): largest catalogue radiator still under demand at ${flowTempC} °C.`,
              severity: "warning",
            });
          }
          continue;
        }
      }

      // No catalogue (or empty): specify the required rating, model TBC.
      emitters.push({
        room: room.name,
        floor: room.floor,
        type: "radiator",
        status: sized.status,
        specification: `${TECHNICAL_DEFAULTS.radiators} radiator ≥ ${round(
          sized.requiredRatedOutputW,
        )} W @ ΔT50 (model TBC)`,
        requiredOutputW: round(demandW),
        providedOutputW: round(demandW),
      });
    }

    audit.push({
      step: `option_${opt.key}`,
      detail: `${flowTempC} °C: cover ${heatPump.coverRatio}, SCOP ${heatPump.scop}, ${emitters.length} emitters (${keepCount} keep / ${replaceCount} replace / ${newCount} new).`,
    });

    return {
      key: opt.key,
      flowTempC,
      deltaTC: EMITTER_SIZING.deltaTC,
      emitters,
      heatPump,
      performance: mcs031.compute({
        flowTempC,
        scop: heatPump.scop,
        designHeatLossKw,
        floorAreaM2: survey.wholeHouse.floorAreaM2,
        dhwOccupants: survey.dhw?.occupants,
      }),
      capitalRank: opt.capitalRank,
      justification: null,
    };
  });

  if (roomsWithoutSurveyedEmitter > 0) {
    raise({
      code: "ufh_not_modelled",
      message: `${roomsWithoutSurveyedEmitter} room(s) have no surveyed emitter; the engine proposed radiators. Confirm whether underfloor heating is intended — UFH sizing is not yet modelled.`,
      severity: "warning",
    });
  }

  audit.push({ step: "recommended", detail: DEFAULT_OPTION });

  return parseDesignResult({
    version: 1,
    options,
    recommended: DEFAULT_OPTION,
    reviewFlags: [...flagMap.values()],
    auditTrace: audit,
  });
}
