# Design decisions

Carried over from the ecosphere-core design-agent work. These are encoded as
typed constants in [`src/config/decisions.ts`](./src/config/decisions.ts) and
verified by `src/config/decisions.test.ts`, so the code and this document stay
in sync.

## 1. Active reasoning layer

Gary's quoting flow is driven by an **active** reasoning layer — the LLM
actively reasons over customer/site inputs and the BOM rather than acting as a
passive text generator. The model defaults to the latest, most capable model
and is overridable via the `ANTHROPIC_MODEL` environment variable.

## 2. Fixed three options at 40 / 45 / 50

Customers are always presented **exactly three** options. The tiers are
**fixed** (not dynamically generated) at the **40 / 45 / 50** levels agreed in
the design-agent work.

## 3. BOM-quantities / Core-prices ownership split

- **Gary owns BOM _quantities_** — how many of each line item a system needs.
- **Ecosphere Core owns _prices_** — Gary never hard-codes or persists its own
  prices; it requests them from Core at quote time.

This boundary is reflected in `src/lib/bom.ts` (quantities, no prices) and
`src/lib/corePrices.ts` (priced lines, sourced from Core).

---

> **Note on provenance:** this Phase 0 scaffold was built from a summary of the
> design-agent decisions, as the source repo/spec was not available in the
> session that created it. If the canonical ecosphere-core spec differs, treat
> it as authoritative and update this file plus `src/config/decisions.ts`.
