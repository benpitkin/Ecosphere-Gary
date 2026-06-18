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
| 2     | Spruce PDF parser → SurveyObject (golden fixture: 3 Orchard Close)          | not started |
| 3     | Deterministic calc engine (emitter sizing + MCS031), tested                 | PRIMITIVES DONE — MCS031 + wiring + fixture validation pending |
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

- **Current phase:** Phase 0 code-complete & merged; **Phase 3 primitives built**.
- **Phase 0:** scaffold merged to `main` — versioned `SurveyObject` / `DesignResult`
  zod contracts (three-option invariant enforced via superRefine), `POST /api/design`
  (validates input, 501 until the engine is wired), stubbed ingestion / engine /
  reasoning / RAG / core modules, and a Supabase migration enabling **pgvector** with
  an empty `knowledge_base` table.
- **Phase 3 (in progress):** the deterministic sizing primitives are implemented as
  pure, unit-tested functions (no LLM, no I/O), and **validated against the golden
  fixture**:
  - `engine/emitter.ts` — EN442 radiator output correction + per-room sizing
    (keep/replacement/new), handling negative-element and infeasible cases.
  - `engine/heatpump.ts` — cover-ratio matching, under/oversize flags, per-flow-temp
    SCOP lookup, model selection.
  - `engine/radiator.ts` — smallest-adequate radiator selection from a catalogue.
  - `engine/catalog/vaillantAroThermPro7kw.ts` — the **real** Vaillant capacity
    matrix + SCOP table from the report, with outdoor-temp interpolation.
  - 53 tests green. Validated against the fixture: 7.54 kW @ 45 °C / -1.5 °C →
    1.33 cover, SCOP 4.43/4.13/3.82 @ 40/45/50; the EN442 factor back-computes
    consistent Stelrad ratings (~1.28 W/mm) across 18 °C and 21 °C rooms.
- **Golden fixture is in the repo:** `fixtures/3-orchard-close.pdf` +
  `src/fixtures/threeOrchardClose.ts` (hand-encoded `SurveyObject` + reference
  figures). Phase 2 (PDF parser) can now be built against it.
- **Blocked on Ben — needed to finish Phase 3:**
  1. **MCS031 methodology** — *MCS 031 Issue 4.0* (the report's example outputs are
     captured: 12,165 kWh heating, 2,938 kWh DHW, SPF 3.4) but the method tables
     (fixed SPF by flow temp/emitter, HDD demand) + tariff/carbon factors are not
     available. Compliance-critical; **not** to be guessed.
  2. **Stelrad catalogue** — rated ΔT50 outputs by model (the selection algorithm
     takes this as input; only the data is missing). Grant performance table too,
     for the alt heat pump.
- **Blocked on Ben — infra & Phase 1:** (a) Supabase free 2-project cap is full
  (main ops DB + Core) → Gary's hosted DB needs a Pro upgrade; (b) Vercel deploy
  needs a token or git-import; (c) Spruce API docs/Extended access for the Phase 1
  client (endpoint payloads are undocumented to me, so the client isn't built yet).
- **Golden fixture:** 3 Orchard Close, Ottery St. Mary (5.65 kW, 13 rooms, Vaillant
  aroTHERM pro 7 kW, SCOP 4.13 @ 45 °C, 45 °C flow, 9 new radiators + UFH).

## Next

1. **Phase 2 (PDF parser):** now buildable against `fixtures/3-orchard-close.pdf`,
   targeting `src/fixtures/threeOrchardClose.ts` as the expected output. Needs a
   decision on the PDF text-extraction library (e.g. `pdf-parse` / `pdfjs-dist`,
   since the `pdftotext` system binary isn't available on Vercel).
2. **Unblock the rest of Phase 3:** provide the MCS031 Issue 4.0 method +
   tariff/carbon factors and the Stelrad catalogue, then wire
   `engine/designOptions` end-to-end and validate "% demand met" against the fixture.
3. **Infra:** Supabase Pro upgrade + Vercel token/import; apply the pgvector
   migration to the hosted DB.
4. **Phase 1:** Spruce API docs → build/typed-test the auth/estimates/jobs client.
5. Only after the engine is proven: **Phase 4** (Claude reasoning/justifications).
