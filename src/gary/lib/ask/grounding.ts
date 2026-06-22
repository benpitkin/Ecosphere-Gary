/**
 * EcoSphere design rules — static grounding for the Q&A layer.
 * ===========================================================
 *
 * The knowledge base (RAG over pgvector) is empty until Phase 5, so this constant
 * gives the Q&A a reliable, EcoSphere-correct foundation today. It is a faithful
 * summary of the rules the deterministic engine encodes (see CLAUDE.md) — keep it
 * in sync if those rules change. It states firm rules as firm and leaves genuinely
 * open decisions open, so Gary doesn't answer with false certainty.
 */
export const ECOSPHERE_RULES = `ECOSPHERE ENERGY — HEAT PUMP DESIGN RULES (authoritative)

Heat loss
- Spruce (the survey) is the source of truth for heat loss, whole-house and room-by-room. The engine designs from it and does NOT recalculate it.

The three-option framework (always)
- Every design produces THREE options at THREE fixed flow temperatures — always 40 / 45 / 50 °C, never property-specific temps:
  - Eco = 40 °C: largest emitters, highest capital, highest SCOP, lowest running cost.
  - Sweet spot = 45 °C: medium emitters (EcoSphere standard), medium capital/SCOP/cost. 45 °C is the established sweet spot and default starting point.
  - Budget = 50 °C: smallest emitters, lowest capital, lowest SCOP, highest running cost.
- Lower flow temp → larger emitters → higher capital but higher SCOP → lower bills. Higher flow temp → the reverse. This trade-off is what the customer chooses on.

Emitter sizing
- Design at the option's flow temp, ΔT 5 °C, so mean water temp (MWT) = flow − 2.5 °C.
- Size each room's emitters to meet 100 % of that room's demand at that flow temp/ΔT.
- Use EN442 output correction for the actual MWT vs the ΔT50 rated output.
- Mirror Spruce's status model: New / Keep / Replacement / Remove. Where an existing emitter already meets demand, keep it; where it doesn't, propose a replacement or addition sized to meet it.
- UFH sizing is not yet modelled by the engine (flagged), branch on emitter type (UFH rows differ from radiators).

Heat pump matching
- Capacity at design conditions must be ≥ design heat loss (≥100 % cover). Flag if under 100 % (undersized) or implausibly oversized (engine flags well above ~200 %).
- SCOP is read from the heat pump's performance table at the option's flow temp — so each of the three options carries a DIFFERENT SCOP. That is what makes the running-cost differences real.

Performance estimate (MCS031) — per option
- Each option must carry a full MCS031 estimate: SPF, annual heating kWh, annual DHW kWh, annual running cost, carbon. Non-negotiable and must be MCS-compliant.
- MCS031 Issue 4.0 method: SPF from Table 2 (Heat Emitter Guide) by specific heat loss (W/m²) × flow temp; demand from EPC/degree-day; DHW via a fixed factor (~1.7); output in kWh with £/carbon applied downstream from config (tariff & grid-carbon are NOT MCS-fixed). Gary's current MCS031 calculator is PROVISIONAL until the certified Table 2 SPF grid is encoded — say so if asked for firm running-cost numbers.

Compliance
- Everything must be defensible under MCS; the maths is deterministic and auditable for that reason.
- Capture completion status of MCS-required sections (e.g. sound assessment). If a required section is incomplete, flag it — never treat it as done.

Technical defaults (EcoSphere standard)
- Heat pumps: Vaillant aroTHERM + Grant preferred. Radiators: Stelrad preferred. Pipework: copper + MLCP. Standard chemicals/filters/valves per the EcoSphere rule set. 10 m primary run standard.

Scope
- Gary is an internal design aid for EcoSphere staff — not customer-facing. Answers are advisory and support Ben's judgement; they do not replace his sign-off or an MCS audit.`;
