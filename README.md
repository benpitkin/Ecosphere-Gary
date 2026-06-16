# Gary

Gary is Ecosphere Energy's quoting and system-design assistant. This repository
currently contains the **Phase 0 scaffold**: a runnable Next.js + TypeScript +
Supabase foundation with CI, plus the architectural decisions encoded as typed
constants so later phases build on solid ground.

## Stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Supabase** for data/auth (project provisioned in a later step)
- **Vitest** for tests, **ESLint** (`next/core-web-vitals`) for lint
- **GitHub Actions** CI: lint → typecheck → test → build

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

- **Phase 0 (this repo):** scaffold, CI, decisions encoded as code.
- **Next:** provision Gary's own Supabase + Vercel projects and wire env.
- **Later:** implement the active reasoning layer, BOM sizing, and Core pricing.
