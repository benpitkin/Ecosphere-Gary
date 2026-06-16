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

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in once Supabase/Core are provisioned
npm run dev                  # http://localhost:3000
```

Health probe: `GET /api/health` reports phase and which integrations are wired.

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the dev server             |
| `npm run build`     | Production build                 |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | `tsc --noEmit`                   |
| `npm test`          | Vitest                           |

## Design decisions

See [`DECISIONS.md`](./DECISIONS.md). They are also encoded as typed constants
in [`src/config/decisions.ts`](./src/config/decisions.ts) and exercised by the
tests in `src/config/decisions.test.ts`.

## Roadmap

- **Phase 0 (this repo):** scaffold, CI, decisions encoded as code.
- **Next:** provision Gary's own Supabase + Vercel projects and wire env.
- **Later:** implement the active reasoning layer, BOM sizing, and Core pricing.
