import { z } from "zod";
import { EmitterStatus, EmitterType } from "@/contracts/survey";

/**
 * DesignResult — the engine output contract.
 * ==========================================
 *
 * What the deterministic engine emits for a single survey: the three options
 * (eco / sweet_spot / budget at 40 / 45 / 50 °C), a recommendation, review flags,
 * and an audit trace. Handed to Core, which attaches pricing. The second of the
 * two stable interfaces — **change only with a version bump**
 * (`DESIGN_RESULT_VERSION`).
 */

export const DESIGN_RESULT_VERSION = 1 as const;

/** The three options are fixed in identity and flow temperature. */
export const OptionKey = z.enum(["eco", "sweet_spot", "budget"]);
export type OptionKey = z.infer<typeof OptionKey>;

/** A designed emitter for a room within an option. */
export const DesignedEmitter = z.object({
  room: z.string(),
  floor: z.string(),
  type: EmitterType,
  status: EmitterStatus,
  /** What the engine specifies (e.g. "Stelrad Type 22 600x1200"). */
  specification: z.string(),
  /** Required output at the option's flow temp / ΔT, watts. */
  requiredOutputW: z.number(),
  /** Output the specified emitter delivers at those conditions, watts. */
  providedOutputW: z.number(),
});
export type DesignedEmitter = z.infer<typeof DesignedEmitter>;

/**
 * MCS031 performance estimate — per option. Non-negotiable and must be
 * MCS-compliant; it justifies the running-cost story and stands up in audit.
 */
export const Mcs031 = z.object({
  /** Seasonal Performance Factor. */
  spf: z.number(),
  annualHeatingKwh: z.number(),
  annualDhwKwh: z.number(),
  annualRunningCostGbp: z.number(),
  /** Annual carbon emissions, kg CO2e. */
  annualCarbonKgCo2e: z.number(),
});
export type Mcs031 = z.infer<typeof Mcs031>;

export const SelectedHeatPump = z.object({
  manufacturer: z.string(),
  model: z.string(),
  /** Capacity at design conditions, kW. */
  capacityAtDesignKw: z.number(),
  /** capacityAtDesign / design heat loss, as a ratio (e.g. 1.33 = 133 %). */
  coverRatio: z.number(),
  /** SCOP read from the performance table at this option's flow temp. */
  scop: z.number(),
});
export type SelectedHeatPump = z.infer<typeof SelectedHeatPump>;

export const DesignOption = z.object({
  key: OptionKey,
  /** 40 | 45 | 50 — always these three, one per option. */
  flowTempC: z.union([z.literal(40), z.literal(45), z.literal(50)]),
  /** ΔT across the emitter, °C (EcoSphere standard: 5). */
  deltaTC: z.number(),
  emitters: z.array(DesignedEmitter),
  heatPump: SelectedHeatPump,
  performance: Mcs031,
  /** Capital cost indicator owned by Gary as relative ordering; Core prices it. */
  capitalRank: z.enum(["highest", "medium", "lowest"]),
  /** Per-option narrative written by the Claude reasoning layer (Phase 4). */
  justification: z.string().nullable(),
});
export type DesignOption = z.infer<typeof DesignOption>;

/** A flag for the human designer (Ben) to review before locking an option. */
export const ReviewFlag = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "blocker"]).default("warning"),
});
export type ReviewFlag = z.infer<typeof ReviewFlag>;

/** A single auditable step the deterministic engine took. */
export const AuditEntry = z.object({
  step: z.string(),
  detail: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

/** The required (key, flowTemp) identity of the three options, in order. */
const REQUIRED_OPTIONS: ReadonlyArray<{ key: OptionKey; flowTempC: 40 | 45 | 50 }> = [
  { key: "eco", flowTempC: 40 },
  { key: "sweet_spot", flowTempC: 45 },
  { key: "budget", flowTempC: 50 },
];

export const DesignResult = z
  .object({
    version: z.literal(DESIGN_RESULT_VERSION),
    /** Exactly three options, in eco → sweet_spot → budget order. */
    options: z.array(DesignOption).length(3),
    /** Which option the engine recommends as the default (spec: sweet_spot). */
    recommended: OptionKey,
    reviewFlags: z.array(ReviewFlag).default([]),
    auditTrace: z.array(AuditEntry).default([]),
  })
  .superRefine((result, ctx) => {
    // The three options must be exactly eco/sweet_spot/budget at 40/45/50, in
    // order — the spec's invariant, not merely "three of something".
    REQUIRED_OPTIONS.forEach((required, i) => {
      const option = result.options[i];
      if (!option) return; // length(3) already reported the shape error
      if (option.key !== required.key || option.flowTempC !== required.flowTempC) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options", i],
          message: `Option ${i} must be '${required.key}' at ${required.flowTempC} °C, got '${option.key}' at ${option.flowTempC} °C.`,
        });
      }
    });
    if (!result.options.some((o) => o.key === result.recommended)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recommended"],
        message: `recommended '${result.recommended}' is not one of the options.`,
      });
    }
  });
export type DesignResult = z.infer<typeof DesignResult>;

/** Parse + validate an engine result (throws on invalid). */
export function parseDesignResult(input: unknown): DesignResult {
  return DesignResult.parse(input);
}
