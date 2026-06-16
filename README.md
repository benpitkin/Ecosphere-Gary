# Gary — EcoSphere Heat Pump Design Agent

Gary takes a completed **Spruce** survey (PDF) and produces **three compliant,
costed design options at flow temps 40 / 45 / 50 °C** (with an MCS031 performance
estimate per option), ready for Ben to check and pull into a **Core** proposal. It
is a standalone, internal (non-customer-facing) service consumed by Core over
HTTPS.

> **Read [`CLAUDE.md`](./CLAUDE.md) first** — it is the single source of truth for
> the product rules, architecture and build phases.

This repository currently contains the **Phase 0 scaffold**: the versioned data
contracts, the `POST /api/design` surface, the Supabase + pgvector knowledge-base
infra, and properly-framed module stubs (ingestion / engine / reasoning / RAG /
core), all under CI.

## Stack

- **Next.js** (App Router) + **React** + **TypeScript**, **zod** for contracts
- **Supabase** (Postgres + **pgvector** for the RAG knowledge base)
- **Vitest** for tests, **ESLint** (`next/core-web-vitals`) for lint
- **GitHub Actions** CI: lint → typecheck → test → build

## API

`POST /api/design` — `SurveyObject` in → `DesignResult` out. Phase 0 validates the
input against the contract and returns `501` until the calc engine (Phase 3) lands.
`GET /api/health` reports phase and which integrations are wired.

## Run locally

Gary runs fully on your machine — no cloud account required.

### Quickest (app only, no database)

The Supabase/Core clients are lazy, so the app boots fine with empty env:

```bash
npm install
npm run dev          # http://localhost:3000
```

`GET /api/health` reports the phase and which integrations are wired (both
`false` in this mode).

### Full local stack (with a local Supabase database)

Requires Docker. This gives you a real Postgres + Supabase Studio locally,
seeded by the migrations in `supabase/migrations/`.

```bash
npm install
npm run db:start     # boots local Supabase (first run pulls Docker images)
npm run db:status    # prints the local URL + anon/service keys
cp .env.local.example .env.local
# paste the keys from db:status into .env.local
npm run dev          # http://localhost:3000  (Studio: http://127.0.0.1:54323)
```

Handy: `npm run db:reset` re-applies migrations from scratch, `npm run db:stop`
tears the stack down.

> Cloud Supabase is intentionally not provisioned yet. When it is, the same env
> vars point at the hosted project instead of localhost.

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the dev server             |
| `npm run build`     | Production build                 |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | `tsc --noEmit`                   |
| `npm test`          | Vitest                           |
| `npm run db:start`  | Boot local Supabase (Docker)     |
| `npm run db:status` | Show local Supabase URL + keys   |
| `npm run db:reset`  | Re-apply migrations locally      |
| `npm run db:stop`   | Stop local Supabase              |

## Design decisions

See [`DECISIONS.md`](./DECISIONS.md). They are also encoded as typed constants
in [`src/config/decisions.ts`](./src/config/decisions.ts) and exercised by the
tests in `src/config/decisions.test.ts`.

## Roadmap

| Phase | Deliverable                                                          |
| ----- | ------------------------------------------------------------------- |
| 0     | Scaffold: contracts, `/api/design`, Supabase + empty pgvector, stubs |
| 1     | Wrap Spruce auth / estimates / jobs                                  |
| 2     | Spruce PDF parser → `SurveyObject` (golden fixture: 3 Orchard Close) |
| 3     | Deterministic calc engine (emitter sizing + MCS031), tested         |
| 4     | Claude reasoning layer: monitor comms → intent → justifications      |
| 5     | Populate the knowledge base (infra built in Phase 0)                |
| 6     | Core integration: hand off the three options for proposal           |

**Sequencing:** build and prove the calc engine (Phase 3) against the golden
fixture before wiring the LLM layer (Phase 4). See `CLAUDE.md`.
