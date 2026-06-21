# Gary — architecture: separate, but able to interact

Gary is a **standalone service**, deliberately decoupled from EcoSphere's other
software (Core, Spruce, OpenSolar, Dispatch, Pulse). It has its own repo, its own
Supabase database, and its own Vercel deployment. It shares **no code and no
database** with any other app — everything crosses a boundary as an **API call**.

This lets Gary be rebuilt, redeployed, or broken without touching the rest of the
stack, and vice versa. Interaction happens two ways.

## Inbound — other tools call Gary

Gary is headless (no customer UI of its own). It exposes versioned HTTP
endpoints; the request/response shapes are zod contracts that only change with a
version bump, so callers don't break silently.

| Endpoint | In → Out | Caller |
|---|---|---|
| `POST /api/design` | `SurveyObject` → `DesignResult` (three options) | Core |
| `POST /api/design/from-pdf` | Spruce PDF (multipart) → `{ survey, result }` | internal `/design` page |
| `POST /api/triage` | `TriageInput` → `TriageResult` | internal `/triage` page (a website widget later) |
| `POST /api/solar/pre-design` | `SolarEnquiry` → `SolarPreDesign` | internal `/solar` page |
| `GET /api/health` | readiness + integration status | ops / uptime checks |

**Auth:** every endpoint except `/api/health` is guarded by `requireApiKey`
(`src/lib/apiAuth.ts`) — a shared secret presented as `Authorization: Bearer
<key>` or `x-api-key: <key>`. It's **env-gated by `GARY_API_KEY`**: off when
unset (local dev, tests, internal pages), enforced when set. Set it in any
exposed environment.

## Outbound — Gary calls other tools

Gary reaches out through one small **adapter per system**, each isolated with its
own credentials, so adding/removing an integration never disturbs the engine.

| Adapter | Direction | Status | Needs |
|---|---|---|---|
| `lib/ingestion/sprucePdf` | Spruce survey → `SurveyObject` | DONE (PDF) | Phase 1 API client pending Spruce API docs |
| `lib/integrations/opensolar` | Gary → OpenSolar project / ← system | reads built, writes stubbed | `OPENSOLAR_API_TOKEN`, `OPENSOLAR_ORG_ID` + auto-design answer |
| `lib/core` | Gary → Core (hand off options) | stub | Core's receive contract |
| `lib/triage/epc` | address → property data | stub | `EPC_API_KEY` |
| `lib/solar/agent` | Gary → Claude (write brief) | DONE | `ANTHROPIC_API_KEY` |

Each adapter has an `is…Configured()` check; `/api/health` reports them all.

## The reasoning layer

Where Gary uses an LLM (solar briefs today; heat-pump justifications later) the
pattern is fixed: a **deterministic engine computes the numbers** (auditable,
MCS-defensible) and **Claude writes prose around them** — never inventing
figures. The Claude call is gated on `ANTHROPIC_API_KEY`; without it the
deterministic result still returns.

## To make interaction live

1. **Deploy** to Vercel (needs a token / git-import) + provision the hosted
   Supabase (Pro upgrade) and apply the pgvector migration → Gary gets a real URL.
2. **Set `GARY_API_KEY`** so only your tools can call it; give the same key to
   Core (and any other caller).
3. **Provision the adapter keys** you want live (`ANTHROPIC_API_KEY`,
   `OPENSOLAR_*`, `EPC_API_KEY`) — see `.env.example`.
4. **(Known gap) staff-session auth:** when `GARY_API_KEY` is on, the internal
   browser pages (`/triage`, `/design`, `/solar`) call the API client-side and
   won't carry the key. For now keep the key unset where staff use the UI, or put
   the deployment behind platform SSO. A later change can split staff-session auth
   from machine auth.

All contracts live in `src/contracts/`; config/secrets in `.env.example`.
