import type { TriageProperty } from "@/contracts/triage";

/**
 * EPC lookup adapter (future).
 * ============================
 *
 * The official England & Wales EPC register (epc.opendatacommunities.org) can
 * turn an address/postcode into property characteristics (floor area, built
 * form, wall/roof/glazing, main fuel, rating) — letting triage run from just an
 * address. It needs a free API key (`EPC_API_KEY`) and a network call, so it's
 * an adapter stubbed here and implemented once the key is provisioned. Until
 * then, triage takes property data as direct input.
 */

export function isEpcConfigured(): boolean {
  return Boolean(process.env.EPC_API_KEY);
}

export async function lookupPropertyByAddress(_address: string): Promise<TriageProperty> {
  throw new Error("EPC lookup not yet implemented — provide EPC_API_KEY and wire the adapter.");
}
