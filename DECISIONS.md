# Design decisions

The authoritative product brief lives in [`CLAUDE.md`](./CLAUDE.md) (read it first).
This file records how those rules are encoded in code. The key constants live in
[`src/config/decisions.ts`](./src/config/decisions.ts) and are verified by
`src/config/decisions.test.ts`, so code and docs stay in sync.

## 1. Active (reactive/observational) reasoning layer

Gary's brain is a Claude reasoning layer that wraps a deterministic maths spine.
It is **reactive and observational**: it monitors customer comms, reads intent, and
writes the per-option justification — it never runs or overrides the maths. Model
defaults to the latest, most capable model, overridable via `ANTHROPIC_MODEL`.

## 2. Three fixed options at 40 / 45 / 50 °C

Always three options — **Eco 40 °C**, **Sweet spot 45 °C** (default), **Budget
50 °C** — modelled from a single Spruce heat loss. Lower flow temp → larger
emitters → higher capital but higher SCOP (lower bills); higher flow temp → the
reverse. This trade-off is what the customer chooses on. No per-property variation
in the temps.

## 3. Design owned by Gary, prices owned by Core

Gary produces the **design** (sized emitters, matched heat pump, MCS031 per option
— the quantities/kit). EcoSphere **Core** owns **pricing**: Gary never hard-codes or
persists prices. Ben checks the options, locks one in, and Core attaches pricing to
build the proposal.

## 4. Deterministic spine, LLM around it

The calc engine is pure, tested TypeScript with **no LLM in the maths** (emitter
sizing at ΔT 5 °C, heat-pump matching, MCS031). It is built and proven against the
3 Orchard Close golden fixture **before** the LLM layer is wired — if the maths is
wrong, the LLM just produces confident wrong options.

## 5. Stable, versioned data contracts

Two zod objects are the interface everything depends on, changed only with a
version bump:

- [`SurveyObject`](./src/contracts/survey.ts) — normalised survey input
  (format-independent: PDF today, API tomorrow).
- [`DesignResult`](./src/contracts/design.ts) — engine output (the three options,
  recommendation, review flags, audit trace).

`POST /api/design` is the entry point Core calls: `SurveyObject` in →
`DesignResult` out.

## 6. Knowledge base from day one

A `knowledge_base` table with a **pgvector** embedding column is created empty in
Phase 0 (`supabase/migrations/0002_pgvector_knowledge_base.sql`) and populated in
Phase 5, so the reasoning layer can ground itself in EcoSphere's rules.

---

> **Provenance:** these decisions are transcribed from EcoSphere's
> `ecosphere_proposal_engine_spec` and the `CLAUDE.md` orientation file. If those
> sources change, they are authoritative — update `CLAUDE.md` and
> `src/config/decisions.ts` together.
