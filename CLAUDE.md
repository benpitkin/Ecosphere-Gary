# CLAUDE.md — EcoSphere Heat Pump Design Agent

> Orientation file. **Read this first, every session.** It is the single source of
> truth for what this project is, the rules behind it, what is built, and what
> comes next. Keep it current — when you finish work, update the **Status** and
> **Next** sections before you stop.

## What this is

A standalone, intelligent heat pump design agent for **EcoSphere Energy Ltd**
(MCS-accredited renewable heating installer, Devon). It is built as its own
project — **own repo, own Supabase, own Vercel** — and is consumed by EcoSphere's
other tools (primarily **Core**) over HTTPS. **It is not customer-facing.**

## The mission (the real goal)

Reduce, and eventually own, the internal design admin that the founder (Ben)
currently does by hand. Today Ben spends too long turning a finished survey into a
correct, compliant, costed proposal. This agent removes that load. The long-term
ambition is explicit: in ~12 months this agent should be capable of doing most of
the design role itself — reading customer context, producing compliant options,
flagging what matters — with Ben checking and approving rather than building from
scratch.

Build every decision with that trajectory in mind: **tool that speeds Ben up now →
tool that owns the design workflow later.**

## What it does, in one line

Takes a completed **Spruce** survey (PDF) and produces **three compliant, costed
design options at three flow temperatures**, ready for Ben to check and pull into a
**Core** proposal.

## The core design philosophy (the rules)

These are EcoSphere's actual design rules. The deterministic engine encodes them.
**Do not let the LLM layer invent or override them.**

### Heat loss

Spruce is the source of truth for heat loss. Accept Spruce's figures as-is
(whole-house and room-by-room). The engine **does not recalculate** heat loss. It
designs from it.

### The three-option framework (the heart of the product)

From a single Spruce heat loss, generate **three options at three flow temps —
always 40 / 45 / 50 °C**:

| Option     | Flow temp | Radiators              | Capital | SCOP    | Running cost |
| ---------- | --------- | ---------------------- | ------- | ------- | ------------ |
| Eco        | 40 °C     | Largest                | Highest | Highest | Lowest       |
| Sweet spot | 45 °C     | Medium (EcoSphere std) | Medium  | Medium  | Medium       |
| Budget     | 50 °C     | Smallest               | Lowest  | Lowest  | Highest      |

**Always all three. Always those three temps.** No property-by-property variation
in which temps are modelled. **45 °C is the established sweet spot and the default
starting point.**

Lower flow temp → larger emitters → higher capital, but higher SCOP → lower bills.
Higher flow temp → smaller emitters → lower capital, lower SCOP → higher bills.
This trade-off is the whole point the customer chooses on.

The hard part this solves: doing three full emitter designs by hand is slow. The
engine does all three in one pass.

### Emitter sizing

- Design at the option's flow temp, **ΔT 5 °C** (so MWT = flow − 2.5 °C).
- Engine sizes emitters per room to meet **100 % of room demand** at that flow
  temp / ΔT.
- Where an existing emitter already meets demand, **keep it**. Where it doesn't,
  propose a replacement/addition sized to meet it. (Mirror Spruce's
  **New / Keep / Replacement / Remove** status model.)

### Heat pump matching

- Capacity at design conditions must be **≥ design heat loss**. Sweet-spot example:
  7.54 kW vs 5.65 kW = 133 % cover. **Flag** if under 100 % or implausibly
  oversized.
- **SCOP is read from the heat pump's performance table at the option's flow temp**
  — so each of the three options carries a different SCOP. This is what makes the
  running-cost differences real.

### Performance estimate (MCS031) — per option

Each of the three options must carry a full **MCS031** performance estimate: SPF,
annual heating kWh, annual DHW kWh, annual running cost, carbon. This is
**non-negotiable** and must be MCS-compliant — it justifies the running-cost story
and stands up in audit.

### Compliance is non-negotiable

Everything the engine produces must be defensible under MCS. The maths is
deterministic and auditable for exactly this reason. Capture completion status of
MCS-required sections (e.g. sound assessment). If a required section is incomplete,
**flag it — never treat it as done**.

### Technical defaults (EcoSphere standard)

Heat pumps: **Vaillant aroTHERM + Grant** preferred. Radiators: **Stelrad**
preferred. Pipework: **copper + MLCP**. Standard chemicals/filters/valves per
EcoSphere rule set. **10 m primary run** standard.

## Architecture (the shape, and why)

- **Separate project.** Own repo / Supabase / Vercel. Core calls it over HTTPS
  (`POST /api/design`, `SurveyObject` in → `DesignResult` out). Zero coupling.
- **TypeScript throughout**, to match Core / Dispatch / Pulse. One stack, one
  skillset (Ben builds solo).
- The agent **never talks to Spruce directly**. It consumes a normalised
  `SurveyObject`. Ingestion adapters feed that object. PDF adapter is the default
  (Spruce API is POST-only — no read endpoint).
- **Deterministic calc engine = the spine.** Pure, tested TypeScript. **No LLM in
  the maths.**
- **LLM layer (Claude) = the brain around the maths.** It is **reactive and
  observational** — it monitors customer comms (emails, call transcripts, notes),
  reads intent, and writes the per-option justification in light of what the
  customer actually said. It does **not** run or steer the customer conversation.
  It listens.
- **Knowledge base (RAG over pgvector) from day one.** Scaffolded empty in Phase 0,
  populated over time: EcoSphere's derived rules, MCS/CIBSE assumptions,
  manufacturer data, past design patterns. The reasoning layer queries it so it
  grounds itself in EcoSphere's rules rather than guessing.

### Spruce integration reality

`POST /v1/auth` → JWT. `POST /v1/estimates` → consultation estimate.
`POST /v1/jobs` → create job. **No GET.** Completed survey comes back as a PDF,
which the parser turns into a `SurveyObject`.

## The end-to-end flow

1. Agent passively monitors customer comms → reads intent.
2. Job pushed to Spruce → engineer surveys on site.
3. Survey PDF parsed → `SurveyObject`.
4. Engine produces three options (40/45/50) + MCS031 per option.
5. Claude writes justifications informed by customer intent.
6. Options handed to Core (not the customer).
7. Ben checks, locks one in; Core attaches pricing and builds the proposal.
8. Proposal goes to the customer.

## Build phases

| Phase | Deliverable                                                                  | Status      |
| ----- | --------------------------------------------------------------------------- | ----------- |
| 0     | Scaffold: repo, schemas, Supabase (+ empty pgvector), Vercel, stubs         | CODE DONE — cloud Supabase/Vercel pending |
| 1     | Wrap Spruce auth / estimates / jobs                                          | not started |
| 2     | Spruce PDF parser → SurveyObject (golden fixture: 3 Orchard Close)          | DONE        |
| 3     | Deterministic calc engine (emitter sizing + MCS031), tested                 | WIRED & FIXTURE-VALIDATED — real MCS031 method + Stelrad data pending (injected) |
| 4     | Claude reasoning layer: monitor comms → intent → justifications             | not started |
| 5     | Populate knowledge base (infra built in Phase 0)                            | not started |
| 6     | Core integration: hand off three options for proposal                       | not started |

**Sequencing rule:** build the calc engine (Phase 3) and prove it correct before
wiring the LLM layer (Phase 4). Validate the engine against the **3 Orchard Close**
golden fixture (its "% demand met" figures), and later against Ben's archive of
past heat losses if useful. If the maths is wrong, Claude just produces confident
wrong options — so the spine comes first.

## Data contracts (the stable interface)

Two **versioned** zod objects everything depends on. Change only with a version
bump.

- **`SurveyObject`** — normalised survey input. Format-independent (PDF today, API
  tomorrow). Holds property, design conditions, `rooms[]`, `whole_house`, `dhw`,
  surveyed `heat_pump`, `flags`.
- **`DesignResult`** — engine output. Holds `options[]` (the three:
  `eco` / `sweet_spot` / `budget`, each with emitters, flow_temp, SCOP, MCS031
  performance, justification), a `recommended` option, designer-review flags, and
  an audit trace.

## PDF parser gotchas (seen in the real 3 Orchard Close report)

- **Table-aware extraction, not flat text.** Summary cards interleave when read
  top-to-bottom; anchor on section headers and read the tables beneath.
- **Negative element heat losses are valid** (internal walls to warmer rooms, e.g.
  −43 W). Don't clamp to zero.
- **Rooms repeat by name** (two "Hall/Landing"). Key by name + floor.
- **Merged zones exist** ("Bed & Ensuite + Bedroom 1"). Handle combined labels.
  (Open decision: keep merged or split when generating options.)
- **Multi-emitter rooms** (Living/Lounge has Keep + Replace rows). Group by room.
- **UFH rows differ from radiator rows** (screed/covering/centres/MWT vs
  dimensions). Branch on emitter type.
- **"Incomplete" sections exist** (sample sound assessment is incomplete). Capture
  status; flag, don't assume done.

## How to work on this

- **Lean and pragmatic.** Solo dev, no big team, no deep cash reserves. Don't
  over-engineer. Don't add effort that isn't needed yet.
- **One thing at a time.** Finish a phase before opening the next.
- Ben feeds information when it's needed — don't design workflows that require big
  manual data-prep up front.
- **Be honest.** If a rule here is wrong or a plan is naive, say so and update this
  file.
- **Update this file at the end of every session:** bump Status, refine Next.

## Status

- **Current phase:** Phase 0 merged; **Phase 3 engine wired end-to-end &
  fixture-validated** (blocked only on Ben's MCS031 method + Stelrad data, both
  injected). Phase 2 DONE.
- **Phase 0:** scaffold merged to `main` — versioned `SurveyObject` / `DesignResult`
  zod contracts (three-option invariant enforced via superRefine), `POST /api/design`
  (validates input, 501 until the engine is wired), stubbed ingestion / engine /
  reasoning / RAG / core modules, and a Supabase migration enabling **pgvector** with
  an empty `knowledge_base` table.
- **Phase 3 (WIRED end-to-end & fixture-validated):** the deterministic engine is
  implemented as pure, unit-tested functions (no LLM, no I/O) and now orchestrated
  end-to-end by `engine/designOptions.ts` (`SurveyObject` → `DesignResult`):
  - `engine/emitter.ts` — EN442 radiator output correction + per-room sizing
    (keep/replacement/new), handling negative-element and infeasible cases.
  - `engine/heatpump.ts` — cover-ratio matching, under/oversize flags, per-flow-temp
    SCOP lookup, model selection.
  - `engine/radiator.ts` — smallest-adequate radiator selection from a catalogue.
  - `engine/catalog/vaillantAroThermPro7kw.ts` — the **real** Vaillant capacity
    matrix + SCOP table from the report, with outdoor-temp interpolation.
  - `engine/mcs031.ts` — MCS031 as an **injected `Mcs031Calculator`**; ships a
    clearly-labelled `provisionalMcs031Calculator` (compliant: false) until Ben's
    Issue 4.0 method + tariff/carbon factors arrive.
  - `engine/designOptions.ts` — builds the three options (eco/sweet_spot/budget @
    40/45/50, ΔT5): per-room keep/replace/new, heat-pump match + SCOP, MCS031 per
    option, de-duplicated `reviewFlags`, and an `auditTrace`. **No fabricated data**:
    with no Stelrad catalogue injected it specifies the exact required ΔT50 rating
    ("model TBC") and raises blocker flags (`mcs031_provisional`,
    `stelrad_catalogue_pending`); per-option `justification` is left null for Phase 4.
  - `POST /api/design` now runs the engine (was 501). An internal **`/design`
    page** + `POST /api/design/from-pdf` chain parse + design so Ben can drop in a
    Spruce PDF and see the three options (blocker flags shown prominently).
  - **79 tests green.** Fixture validation: 7.54 kW @ 45 °C / -1.5 °C → 1.33 cover,
    SCOP 4.43/4.13/3.82 @ 40/45/50; keep/replace decisions reproduce the report
    (Hall/Landing kept, Living/Lounge & Study replaced at 45 °C) and demonstrate the
    flow-temp trade-off (Living/Lounge becomes a keep at 50 °C). Real MCS031 numbers
    and concrete Stelrad models drop in via the injected deps with no rework.
- **Golden fixture is in the repo:** `fixtures/3-orchard-close.pdf` +
  `src/fixtures/threeOrchardClose.ts` (hand-encoded `SurveyObject` + reference
  figures).
- **Phase 2 (DONE):** `src/lib/ingestion/sprucePdf.ts` parses a Spruce report
  PDF into a `SurveyObject` via `pdf-parse` (pure-JS, Vercel-friendly), validated to
  reproduce the golden fixture's 13 rooms (floor/temp/loss/area), heat pump, design
  conditions, and the incomplete-sound-assessment flag. Floors are assigned from the
  stated floor subtotals (disambiguating the two Hall/Landing). **Per-room existing
  emitters are now extracted too** (`extractRoomEmitters`): the "Emitter performance"
  tables in the detailed room sections yield each room's surveyed radiators
  (type/status "keep"/description/outputW), zipped onto rooms by section order and
  reproducing the fixture's 6 radiators across 5 rooms exactly (incl. the
  multi-emitter Living/Lounge and the empty UFH rooms).
- **Triage (new capability, front-of-funnel):** `POST /api/triage` + an internal
  staff page at `/triage`. Deterministic, pure engine (`src/lib/triage`): address +
  qualifying answers → recommended next action (book survey / human follow-up /
  gather info / nurture / not suitable) + an *indicative* heat-pump size band +
  flags. Runs **before** a survey (so it does not use the design engine). EPC
  address-lookup is stubbed (`lib/triage/epc.ts`) pending an `EPC_API_KEY`.
  Internal-only for now — a customer-facing website chatbot would cross the spec's
  "not customer-facing" rule and is a deliberate decision still to be made.
- **OpenSolar (new direction, Ben — scaffolded):** have Gary do **initial solar (PV)
  designs** in OpenSolar to cut that hand-work. Researched + scaffolded as its own
  **integration adapter** (`src/lib/integrations/opensolar`), decoupled from the
  heat-pump engine — OpenSolar's AI ("Ada") does the design; Gary feeds inputs and
  reads the resulting "system" (size/output/offset/price/CO2). Confirmed read
  endpoints (`GET /api/orgs/:org_id/systems/…`, bearer + org auth) are implemented;
  project-creation payload and the auto-design trigger are **stubbed, not guessed**
  (same discipline as the Spruce client). Config via `OPENSOLAR_API_TOKEN` /
  `OPENSOLAR_ORG_ID`. Full feasibility + asks: `docs/opensolar-integration.md`.
  **Open question for OpenSolar support:** is initial/auto-design REST-triggerable,
  or does it require the browser Studio SDK? That decides how headless Gary can be.
- **Solar Pre-Design Agent (Ben — BUILT; Gary's first real Claude integration):**
  the **EcoSphere Solar Pre-Design Agent** sits *upstream of OpenSolar* — turns a
  raw enquiry into a structured, sales-ready pre-design brief Ben/Natasha review
  before committing to a full OpenSolar design. Same architecture as the heat-pump
  side: a **deterministic sizing spine** (`src/lib/solar/sizing.ts`, pure + tested)
  computes kWp/panels/inverter/battery/generation/self-consumption and the **DNO
  G98/G99 threshold** (>3.68 kW/phase → G99), with documented UK/SW defaults; the
  **Claude reasoning layer** (`src/lib/solar/agent.ts`, `@anthropic-ai/sdk`,
  `claude-opus-4-8`, adaptive thinking, JSON-schema structured output validated by
  our zod `SolarBrief`) writes the brief *around* those numbers — never inventing
  them. `POST /api/solar/pre-design` (`SolarEnquiry`→`SolarPreDesign`). Reasoning is
  **gated on `ANTHROPIC_API_KEY`**: without it the deterministic sizing returns and
  `brief` is null. **Indicative pre-survey, never a quote** (enforced disclaimer).
  Contracts in `src/contracts/solar.ts`; Ben's prompt in `src/lib/solar/prompt.ts`.
- **Stelrad catalogue — DONE (found online & wired):** `catalog/stelradCompact.ts`
  encodes the real Stelrad Compact ΔT50 outputs from the EN442/CETIAT certified
  W/m figures; it's the engine's default `radiatorCatalogue`, so concrete models are
  now selected (Grant heat-pump table still wanted for the alt heat pump).
- **MCS031 — method found & documented (`docs/mcs031-findings.md`); one piece still
  needed:** Issue 4.0 uses an SPF from **Table 2 (Heat Emitter Guide)** by specific
  heat loss (W/m²) × flow temp; demand from EPC/degree-day; DHW via a fixed factor
  (~1.7); output is **kWh** with **£/carbon applied downstream from config** (tariff
  & grid-carbon are NOT MCS-fixed). The exact **Table 2 SPF grid** is the missing
  compliance-critical piece — the free MCS 031 v4.0 PDF blocks automated download,
  so **Ben to drop the PDF in `fixtures/` (or paste Table 2)**, then it's encoded as
  a `compliant` `Mcs031Calculator`. The Issue 3 SCoP-by-flow table + Heat Emitter
  Guide oversize factors were captured as reference. **Not guessed.**
- **Blocked on Ben — infra & Phase 1:** (a) Supabase free 2-project cap is full
  (main ops DB + Core) → Gary's hosted DB needs a Pro upgrade; (b) Vercel deploy
  needs a token or git-import; (c) Spruce API docs/Extended access for the Phase 1
  client (endpoint payloads are undocumented to me, so the client isn't built yet).
- **Golden fixture:** 3 Orchard Close, Ottery St. Mary (5.65 kW, 13 rooms, Vaillant
  aroTHERM pro 7 kW, SCOP 4.13 @ 45 °C, 45 °C flow, 9 new radiators + UFH).

## Next

1. **Finish Phase 3 (engine wired; Stelrad DONE):** only MCS031 remains — drop the
   MCS 031 Issue 4.0 PDF in `fixtures/` (or paste Table 2's SPF grid) + confirm the
   electricity tariff & grid-carbon factor (config, not MCS-fixed); then encode a
   `compliant` `Mcs031Calculator` replacing `provisionalMcs031Calculator` and the
   last blocker clears. See `docs/mcs031-findings.md`. (UFH sizing still not
   modelled — flagged `ufh_not_modelled`; decide if/when to add wet-UFH sizing.)
2. **Direction set (Ben, this session):** Gary stays the **internal design engine**
   (Core only builds proposals — it does *not* produce the three compliant costed
   options, so Gary is not redundant). Build the engine now; keep the surface
   decision open (it can feed Core today and a website *triage* widget later —
   customer-facing *design advice* stays off the table per spec).
3. ~~Phase 2 follow-up (per-room emitters)~~ — **DONE** this session.
4. **OpenSolar (Ben):** provision API access (`OPENSOLAR_API_TOKEN` /
   `OPENSOLAR_ORG_ID`), confirm the access tier (standard vs Raw Data), and ask
   OpenSolar whether auto-design is REST-triggerable vs Studio-SDK-only. Then finish
   the adapter: implement `createProjectFromInput` + `requestAutoDesign` and wire
   survey/triage data → project → read-back system. See `docs/opensolar-integration.md`.
5. **Infra:** Supabase Pro upgrade + Vercel token/import; apply the pgvector
   migration to the hosted DB.
6. **Phase 1:** Spruce API docs → build/typed-test the auth/estimates/jobs client.
7. Only after the engine is proven: **Phase 4** (Claude reasoning/justifications).
