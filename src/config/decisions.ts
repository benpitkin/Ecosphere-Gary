/**
 * Gary — Phase 0 design decisions
 * ================================
 *
 * This module is the single source of truth for the architectural decisions
 * carried over from the ecosphere-core design-agent work. Encoding them as
 * typed constants (rather than scattering magic numbers/strings) keeps the
 * rest of the codebase honest as Gary grows beyond Phase 0.
 */

/**
 * Decision 1 — Active reasoning layer.
 *
 * Gary's quoting flow is driven by an *active* reasoning layer: the LLM
 * actively reasons over the customer's inputs and the BOM rather than acting
 * as a passive text generator. The provider defaults to the latest, most
 * capable model and is overridable via the ANTHROPIC_MODEL env var.
 */
export const REASONING = {
  /** Whether the reasoning layer drives the flow (vs. a passive template). */
  mode: "active" as const,
  /** Default model when ANTHROPIC_MODEL is unset. */
  defaultModel: "claude-opus-4-8",
} as const;

/**
 * Decision 2 — Fixed three options at 40 / 45 / 50.
 *
 * Customers are always presented exactly three options. The three tiers are
 * fixed (not dynamically generated) at the 40 / 45 / 50 levels agreed in the
 * design-agent work. Treated as an ordered, immutable tuple.
 */
export const OPTION_TIERS = [40, 45, 50] as const;
export type OptionTier = (typeof OPTION_TIERS)[number];

/** Exactly three options are always offered. */
export const OPTION_COUNT = OPTION_TIERS.length; // 3

/**
 * Decision 3 — BOM-quantities / Core-prices split.
 *
 * Ownership boundary: Gary computes Bill-of-Materials *quantities*; Ecosphere
 * Core remains the source of truth for *prices*. Gary must never hard-code or
 * persist its own prices — it requests them from Core at quote time.
 */
export const OWNERSHIP = {
  /** Gary owns how many of each line item a system needs. */
  bomQuantities: "gary" as const,
  /** Core owns the unit price of each line item. */
  prices: "core" as const,
} as const;
