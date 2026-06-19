# OpenSolar integration — feasibility & plan

> Status: **scaffolded, blocked on API access**. Researched 2026-06. This captures
> what's confirmed from OpenSolar's public docs, what Gary can do, and exactly
> what's needed from Ben to finish it. Nothing here fabricates OpenSolar payloads
> — undocumented request shapes are left as stubs (same discipline as the Spruce
> Phase 1 client).

## The ask

Have Gary complete **initial solar (PV) designs** in OpenSolar, to remove the
hand-work of setting projects up and getting a first design out — mirroring what
Gary does for heat-pump design.

## Verdict: yes, with one open question

It's feasible and a good fit for the mission ("reduce the internal design admin
Ben does by hand"). It is an **integration/orchestration** job, not a Gary calc
job — **OpenSolar's own AI ("Ada") does the design**; Gary feeds it the inputs and
reads the result. So this lives as its own adapter (`lib/integrations/opensolar`),
decoupled from the heat-pump engine — same shape as the Spruce adapter and the
Core hand-off.

The one thing public docs don't settle: **whether an initial design can be
*triggered* purely over REST, or whether design generation requires OpenSolar's
browser SDK ("Studio") / a person opening the project so Ada designs it.** That
decides how "hands-off" Gary can be (see Open Questions).

## What OpenSolar exposes (confirmed from docs)

OpenSolar offers **two** developer surfaces:

1. **REST API** (`https://api.opensolar.com`) — bearer-token auth, org-scoped.
   - Auth: `Authorization: Bearer <token>`; org in the path (`/api/orgs/:org_id/…`).
   - **Projects**: created via API — the documented "lead import" use case
     (name, address, contact, utility/energy info → a new OpenSolar project).
   - **Systems** (a "system" = a complete design): `GET /api/orgs/:org_id/systems/`
     and `…/systems/:id/`, with rich fields — `kw_stc` (system size), `module_quantity`,
     `output_annual_kwh`, `consumption_offset_percentage`, `battery_total_kwh`,
     `co2_tons_lifetime`, and pricing. Supports `project=` / `page` / `limit`.
   - **Tiers**: standard **API Access** vs **Raw Data API Access** (separate,
     priced) — *deeper design & proposal data* sits behind Raw Data Access.

2. **JavaScript SDK ("Studio")** — embeds OpenSolar's design canvas in your own
   web app and drives it client-side: `ossdk.project_form.setValues()`,
   `ossdk.studio.setComponents()` (panels/inverters/batteries),
   `ossdk.project_form.getDesignData()`, `ossdk.studio.getSystemImageUrl()`,
   `ossdk.flows.generateDocument()` (proposal/shade report). This is browser-side,
   not server-to-server.

3. **Ada** — OpenSolar's AI that auto-designs multiple systems "in seconds"
   according to the org's design preferences. Lives in Studio/UI; **no confirmed
   public REST "design now" endpoint.**

## Proposed architecture

```
SurveyObject / lead data ──► lib/integrations/opensolar
                              ├─ createProjectFromInput()   (REST: lead import)   [payload TBC]
                              ├─ requestAutoDesign()         (Ada trigger)         [mechanism TBC]
                              └─ getSystem()/listSystems()   (REST: read result)   [confirmed]
                                        │
                                        ▼
                              OpenSolarSystem  (size, output, offset, price, CO2)
                                        │
                                        ▼
                              Core / Ben review
```

- **Address & energy use Gary already holds** (from the survey / triage) seed the
  OpenSolar project — no re-keying.
- Gary reads the resulting `system` back (size/output/offset/price/CO2) for Ben to
  check, and later for Core to fold into a proposal alongside the heat-pump options.

## What's needed from Ben (blockers)

1. **API access**: an OpenSolar account with API enabled → a **bearer token** and
   the **org_id**. Set as `OPENSOLAR_API_TOKEN` and `OPENSOLAR_ORG_ID` (the
   scaffold reads these; `OPENSOLAR_BASE_URL` optional, defaults to
   `https://api.opensolar.com`).
2. **Tier confirmation**: does our use need **Raw Data API Access** (the paid tier)
   for design/proposal data, or does standard API Access suffice for create-project
   + read-system? (Cost decision.)
3. **Answer the open question below** (likely a short note to OpenSolar support).
4. **Design preferences** configured in the OpenSolar org (default panel/inverter,
   layout rules) so Ada's auto-design matches EcoSphere's standard.

## Open questions (for OpenSolar support)

- Can an **initial/auto design (Ada) be triggered via REST** for a project (input
  → system), or is design generation only available through the **Studio SDK** /
  the UI? This determines whether Gary can be fully headless or needs a
  Studio-embedding step.
- Exact **create-project** request payload (fields, required vs optional) — not in
  the public docs; needed before we build the writer (kept as a stub until then).
- Which **system/design fields** require Raw Data API Access vs standard.

## Current scaffold (this repo)

`src/lib/integrations/opensolar/`
- `index.ts` — env-gated config (`openSolarConfigFromEnv`, `isConfigured`), typed
  `OpenSolarSystem`, and a client with **confirmed reads implemented**
  (`getSystem`, `listSystems`) and **unconfirmed writes/auto-design stubbed**
  (`createProjectFromInput`, `requestAutoDesign` throw a clear "pending" error).
- `opensolar.test.ts` — env gate + request (URL/bearer) and response parsing via a
  mocked fetch (no network).

Once Ben supplies the token/org_id and OpenSolar confirms the auto-design
mechanism + create-project payload, the stubs become real with no change to the
module's shape or its consumers.
