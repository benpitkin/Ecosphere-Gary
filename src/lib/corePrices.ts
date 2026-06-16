import type { Bom } from "@/lib/bom";

/**
 * Ecosphere Core — price source of truth.
 *
 * Gary never stores its own prices. At quote time it sends a BOM (quantities)
 * to Core and Core returns priced lines. Phase 0 ships the client contract;
 * the HTTP implementation is wired up once Core's endpoint is finalised.
 */

export interface PricedLine {
  readonly sku: string;
  readonly quantity: number;
  /** Unit price, owned by Core. */
  readonly unitPrice: number;
  readonly currency: string;
}

export interface PricedBom {
  readonly lines: readonly PricedLine[];
  readonly total: number;
  readonly currency: string;
}

/** Returns true once Core's endpoint is configured. */
export function isCoreConfigured(): boolean {
  return Boolean(process.env.CORE_API_BASE_URL && process.env.CORE_API_KEY);
}

/** Phase 0 placeholder — Core HTTP call implemented in a later phase. */
export async function priceBom(_bom: Bom): Promise<PricedBom> {
  throw new Error("Core pricing client not yet implemented (Phase 0 scaffold).");
}
