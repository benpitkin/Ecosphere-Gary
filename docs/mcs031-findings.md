# MCS 031 performance estimate — research findings

> Status: **method understood; exact Issue 4.0 SPF table still needed.** Researched
> 2026-06 from public sources. This is what Gary needs to produce an MCS-compliant
> performance estimate, what was found online, and the one piece still missing.
> Compliance-critical numbers are **not guessed** — see "Still needed".

## What MCS 031 produces

MCS 031 = "Heat Pump – Pre-Sale Information and Performance Calculation". It
produces, per system, the **annual energy** figures (space-heating kWh, hot-water
kWh, and the electricity the heat pump will consume), from which running cost and
carbon are derived. **Issue 4.0** (published 18/12/2024, mandatory from
18/03/2025) is the current version.

## The method (confirmed)

1. **Energy demand (kWh).** Space-heating and hot-water demand come from a valid
   **EPC**, or from a **degree-day calculation** on the project's heat loss when
   EPC figures aren't used. (Example seen: 3055 kWh heating + 1838 kWh DHW.)
2. **Efficiency.**
   - **Issue 4.0 (current):** SPF is looked up from **Table 2 (Heat Emitter
     Guide)** by the property's **specific heat loss (W/m²)** and the **flow
     temperature** — so the emitter system actually affects the number. This
     replaced the old flat-SCoP approach because SCoP overestimated real SPF.
   - **Issue 3 (superseded, for reference):** a flat **SCoP-by-flow-temp** table
     (see below).
   - **DHW:** a fixed water-heating factor (SAP-based; the Heat Emitter Guide /
     Heatpunk cite **1.7**; older SCoP method used a SAP2012 default ≈ 2.7).
3. **Electricity = demand ÷ SPF** (heating at the looked-up SPF, DHW at the DHW
   factor), summed.
4. **Running cost & carbon are NOT fixed by MCS.** The estimate is in **kWh**; £
   and kgCO₂e are applied downstream using the **current electricity tariff** and
   **grid carbon factor**. → In Gary these must be **config inputs Ben sets**, not
   constants baked into the engine. (Suggested current values: electricity ≈
   24–27 p/kWh; grid carbon ≈ 0.136 kgCO₂e/kWh per SAP 10.2 — Ben to confirm.)

## Issue 3 SCoP-by-flow-temp table (reference only — superseded by 4.0)

From a real MCS performance estimate printout (Octopus/Daikin, 2023):

| Flow °C | SCoP | Flow °C | SCoP | Flow °C | SCoP |
|--------:|-----:|--------:|-----:|--------:|-----:|
| 35 | 4.37 | 43 | 3.83 | 51 | 3.38 |
| 36 | 4.30 | 44 | 3.77 | 52 | 3.33 |
| 37 | 4.24 | 45 | **3.70** | 53 | 3.27 |
| 38 | 4.17 | 46 | 3.65 | 54 | 3.22 |
| 39 | 4.10 | 47 | 3.59 | 55 | 3.17 |
| 40 | 4.04 | 48 | 3.54 | | |
| 41 | 3.97 | 49 | 3.49 | | |
| 42 | 3.90 | 50 | **3.43** | | |

Note this is a *standardised* curve — it differs from the manufacturer's own SCOP
(e.g. the 3 Orchard Close Vaillant reads 4.13 @ 45 °C). **Decision for Ben:** the
MCS 031 performance SPF should come from Table 2, which may differ from the
heat-pump's catalogue SCOP that Gary already uses for capacity matching. Keep both:
catalogue SCOP for sizing/cover, Table 2 SPF for the MCS 031 figure.

## Heat Emitter Guide (MCS 021) — found, and relevant to sizing

The MCS Heat Emitter Guide (MCS 021, downloaded) gives the **emitter oversize
factors by flow temperature** (e.g. radiators: ≤35→4.3, 41–45→2.4, 46–50→2.0,
51–55→1.7 …) and the Temperature Star Rating. This is the MCS *emitter-sizing*
basis. Gary's engine sizes via continuous EN442 ΔT correction, which is what the
Spruce report itself uses (its "% demand met @ 45 °C" figures) — so the engine is
already consistent with the report. The oversize-factor banding is an alternative;
no change needed unless Ben wants the banded method too.

## Still needed (the one missing compliance-critical piece)

1. **MCS 031 Issue 4.0 Table 2 — the SPF grid** (specific heat loss W/m² ×
   flow temp). It's on ~page 16 of the standard. The PDF is **free** but the MCS
   site blocks automated download (404/403 to scripts). → **Ask:** Ben downloads
   `MCS 031 Issue 4.0` from mcscertified.com and drops it in `fixtures/` (or pastes
   Table 2), and I encode it as a `compliant: true` `Mcs031Calculator`. *Or* say
   "use the Issue 3 SCoP table / Heat Emitter Guide as an interim" and I wire that
   (clearly flagged non-final).
2. **Tariff & grid carbon factor** — the current values Ben wants used (these are
   EcoSphere/Core config, not MCS-fixed). I'll expose them as named config.

## How it slots in (no rework)

The engine already injects MCS031 via `Mcs031Calculator` (currently the flagged
`provisionalMcs031Calculator`). Once Table 2 + the factors are in hand, that's one
new calculator object with `compliant: true`; the blocker flag clears
automatically. Energy stays the compliance core; cost/carbon read from config.

## Sources

- MCS 031 update (method): https://mcscertified.com/an-update-to-mcs-031-the-heat-pump-pre-sale-information-and-performance-calculation/
- Easy-MCS write-up: https://www.easy-mcs.com/2025/03/13/new-mcs-031/
- Heatpunk performance task (DHW 1.7, EPC/degree-day): https://help.heatpunk.co.uk/books/heat-pump-task-and-system-performance/page/performance-task
- MCS 021 Heat Emitter Guide (PDF): https://www.grantuk.com/media/1386/mcs-021-heat-emitter-guide-for-domestic-heat-pumps-issue-21.pdf
- Real performance-estimate example (Issue 3 SCoP table): https://docs.planning.org.uk/20231221/145/S5CH9XQCFHK00/b7yvkt5nw174kmix.pdf
