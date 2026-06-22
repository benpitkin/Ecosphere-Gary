# Embedding Gary into Core

> Decision (Ben): build Gary **inside Core** rather than as a separate service —
> Core already has a database, Gary's job (assessing designs/quotes) needs Core's
> data, and one codebase ships faster solo. Keep the option to split him out later.
> This repo is now structured so that's a clean lift, not a rewrite.

## What you copy

Everything portable lives under **`src/gary/`** — pure TypeScript, no framework
coupling, configured only via env vars. Copy that one folder into Core (e.g.
`core/src/gary/`) and you have the whole engine:

```
src/gary/
  index.ts            ← the public surface — import from here
  contracts/          survey · design · triage · solar  (versioned zod types + parsers)
  config/decisions.ts the encoded EcoSphere design rules
  lib/
    engine/           heat-pump design (designOptions) + catalogs (Vaillant, Stelrad)
    ingestion/        Spruce PDF → SurveyObject
    triage/           front-of-funnel triage (+ EPC adapter stub)
    solar/            solar sizing (deterministic) + Claude brief (agent)
    review/           design & quote reviewer (deterministic checks + Claude suggestions)
    ask/              technical Q&A (grounded in EcoSphere rules + Claude)
    integrations/opensolar/   OpenSolar adapter
    apiAuth.ts        optional shared-secret guard (only if Gary exposes HTTP itself)
    supabase.ts core/ rag/ reasoning/   small helpers/stubs
  fixtures/           golden test fixture (3 Orchard Close)
```

What you **don't** copy: `src/app/` (the Next.js routes + staff pages). Those are
this repo's own glue. In Core you re-create them as Core routes or server actions
that call the `@/gary` barrel — they're thin (parse request → call function →
return JSON); see `src/app/api/*/route.ts` here as the reference.

## How you call it

One import point:

```ts
import {
  designOptions,            // SurveyObject → DesignResult (three options)
  parseSprucePdf,           // Spruce PDF → SurveyObject
  triage,                   // TriageInput → TriageResult
  solarPreDesign,           // SolarEnquiry → SolarPreDesign
  reviewDesignQuote,        // ReviewInput → ReviewResult (assess a design + quote)
  parseSurveyObject,        // + the other contract parsers
} from "@/gary";
```

Assumes Core uses the `@/* → src/*` path alias (standard Next). If Core's alias
differs, either copy to the matching path or adjust the alias prefix.

## Dependencies

Gary pulls: `zod`, `@anthropic-ai/sdk` (solar/justification reasoning),
`pdf-parse` (Spruce ingestion). Add any Core doesn't already have. Node runtime
required for the PDF and crypto paths (not Edge).

## Environment / config

All optional; each capability degrades gracefully when its key is absent (see
`.env.example`):

- `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) — enables the Claude brief;
  without it the deterministic results still return.
- `OPENSOLAR_API_TOKEN` / `OPENSOLAR_ORG_ID` — OpenSolar adapter.
- `EPC_API_KEY` — address-based triage lookup.
- `GARY_API_KEY` — only needed if Core re-exposes Gary's endpoints externally;
  internal in-process calls don't need it.

## Database

Drop the separate Supabase project. Gary's only DB need is the **pgvector
knowledge base** (RAG, Phase 5) — apply the migration in
`supabase/migrations/0002_pgvector_knowledge_base.sql` to **Core's** database
(enable the `vector` extension, create `knowledge_base`). Until RAG is populated,
nothing in the engine reads the DB, so this can wait.

## The "separate later" path

Because `src/gary/` depends on nothing in the host (no Core imports, env read only
at the edges, all I/O via injected deps or explicit adapters), extracting it back
into a standalone service later is just: move the folder into its own repo, add
back the `src/app` HTTP layer (kept here as reference), point it at its own DB.
Embedding now does not burn that bridge.

## Status carried over

The engine is wired and fixture-validated; the only blocker to fully-compliant
heat-pump output is the MCS031 Issue 4.0 SPF table (see `docs/mcs031-findings.md`).
Solar pre-design, the design/quote reviewer and ask-Gary (technical Q&A) are
built and gated on `ANTHROPIC_API_KEY`. 137 tests green.

## The Ask-Gary chat widget (Core's bottom-right assistant)

To replace Core's bottom-right AI assistant with Gary: copy
`src/app/_components/AskGaryWidget.tsx` into Core's app and mount it once in
Core's root layout (`<AskGaryWidget />`). It's self-contained (React + the
`AskResult` type from `@/gary`) and talks to `POST /api/ask`; set the `endpoint`
prop if Core mounts the ask route at a different path. The launcher icon is a
"little man" SVG. Needs `ANTHROPIC_API_KEY` set server-side (the route returns a
clean 503 otherwise, which the widget surfaces).
