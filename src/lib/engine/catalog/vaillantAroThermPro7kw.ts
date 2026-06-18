import type { HeatPumpModel } from "@/lib/engine/heatpump";
import { FLOW_TEMPS_C } from "@/config/decisions";

/**
 * Vaillant aroTHERM pro 7kW (VWL 75/7.1) — manufacturer performance data.
 * ======================================================================
 *
 * Transcribed from the 3 Orchard Close heat loss report's heat-pump datasheet
 * (real manufacturer figures, not estimates). Capacity varies with both outdoor
 * air temperature and flow temperature; SCOP varies with flow temperature.
 *
 * `modelAt(outsideTempC)` linearly interpolates capacity on outdoor temperature
 * to produce a `HeatPumpModel` at the site design condition, for the three
 * option flow temps (40/45/50). At -1.5 °C this reproduces the report's headline
 * 7.54 kW @ 45 °C.
 */

const FLOW_COLUMNS = [35, 40, 45, 50, 55] as const;
type FlowColumn = (typeof FLOW_COLUMNS)[number];

/** Capacity (kW): rows = outdoor °C, columns = flow °C (35/40/45/50/55). */
const CAPACITY_KW: ReadonlyArray<{ outsideTempC: number; byFlow: Record<FlowColumn, number> }> = [
  { outsideTempC: -5, byFlow: { 35: 6.51, 40: 6.65, 45: 6.78, 50: 6.31, 55: 5.84 } },
  { outsideTempC: -3, byFlow: { 35: 6.87, 40: 7.02, 45: 7.16, 50: 6.69, 55: 6.22 } },
  { outsideTempC: 0, byFlow: { 35: 7.73, 40: 7.83, 45: 7.92, 50: 7.31, 55: 6.69 } },
  { outsideTempC: 2, byFlow: { 35: 8.45, 40: 8.47, 45: 8.49, 50: 7.8, 55: 7.1 } },
  { outsideTempC: 5, byFlow: { 35: 9.68, 40: 9.41, 45: 9.15, 50: 8.25, 55: 7.35 } },
];

/** SCOP by flow temperature. */
const SCOP_BY_FLOW: Record<FlowColumn, number> = {
  35: 4.74,
  40: 4.43,
  45: 4.13,
  50: 3.82,
  55: 3.52,
};

function isFlowColumn(flowTempC: number): flowTempC is FlowColumn {
  return (FLOW_COLUMNS as readonly number[]).includes(flowTempC);
}

/** Linearly interpolate capacity on outdoor temp for a known flow column (clamped). */
export function capacityKw(outsideTempC: number, flowTempC: FlowColumn): number {
  const rows = CAPACITY_KW;
  if (outsideTempC <= rows[0].outsideTempC) return rows[0].byFlow[flowTempC];
  const last = rows[rows.length - 1];
  if (outsideTempC >= last.outsideTempC) return last.byFlow[flowTempC];
  for (let i = 0; i < rows.length - 1; i++) {
    const lo = rows[i];
    const hi = rows[i + 1];
    if (outsideTempC >= lo.outsideTempC && outsideTempC <= hi.outsideTempC) {
      const t = (outsideTempC - lo.outsideTempC) / (hi.outsideTempC - lo.outsideTempC);
      return lo.byFlow[flowTempC] + t * (hi.byFlow[flowTempC] - lo.byFlow[flowTempC]);
    }
  }
  return last.byFlow[flowTempC]; // unreachable
}

export function scopAtFlow(flowTempC: FlowColumn): number {
  return SCOP_BY_FLOW[flowTempC];
}

/** Build a HeatPumpModel at a given outdoor temp for the three option flow temps. */
export function modelAt(outsideTempC: number): HeatPumpModel {
  return {
    manufacturer: "Vaillant",
    model: "aroTHERM pro 7kW",
    performance: FLOW_TEMPS_C.map((flowTempC) => {
      if (!isFlowColumn(flowTempC)) {
        throw new Error(`No catalogue column for flow temp ${flowTempC} °C`);
      }
      return {
        flowTempC,
        capacityKw: capacityKw(outsideTempC, flowTempC),
        scop: scopAtFlow(flowTempC),
      };
    }),
  };
}
