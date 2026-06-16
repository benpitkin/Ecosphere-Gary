import { OWNERSHIP, type OptionTier } from "@/config/decisions";

/**
 * Bill of Materials — quantities.
 *
 * Gary owns BOM *quantities* (see OWNERSHIP in config/decisions). Each line
 * item is a SKU plus how many are required. Prices are deliberately absent
 * here — they are resolved against Ecosphere Core (see lib/corePrices).
 */

export interface BomLine {
  /** Stable SKU/identifier understood by Ecosphere Core. */
  readonly sku: string;
  /** How many of this item the system requires. Owned by Gary. */
  readonly quantity: number;
}

export type Bom = readonly BomLine[];

/**
 * Phase 0 placeholder: returns an empty BOM for a given option tier. The real
 * sizing logic (driven by the active reasoning layer) lands in a later phase.
 */
export function buildBom(_tier: OptionTier): Bom {
  // Asserts the ownership contract at the type level for future maintainers.
  void OWNERSHIP.bomQuantities;
  return [];
}
