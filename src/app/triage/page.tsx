"use client";

import { useState } from "react";
import type { TriageResult } from "@/gary/contracts/triage";

const label: Record<string, string> = {
  book_survey: "Book a survey",
  human_follow_up: "Human follow-up",
  gather_info: "Gather more info",
  nurture: "Nurture",
  not_suitable: "Not suitable (yet)",
};

const sev: Record<string, string> = {
  info: "#2563eb",
  warning: "#b45309",
  blocker: "#b91c1c",
};

export default function TriagePage() {
  const [result, setResult] = useState<TriageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    const f = new FormData(e.currentTarget);
    const numOrUndef = (v: FormDataEntryValue | null) =>
      v && String(v).trim() !== "" ? Number(v) : undefined;
    const body = {
      address: String(f.get("address") ?? ""),
      property: {
        floorAreaM2: numOrUndef(f.get("floorAreaM2")),
        wallType: f.get("wallType") || undefined,
        glazing: f.get("glazing") || undefined,
        ageBand: f.get("ageBand") || undefined,
        mainFuel: f.get("mainFuel") || undefined,
      },
      answers: {
        ownerOccupier: f.get("ownerOccupier") || "unknown",
        listedOrConservation: f.get("listedOrConservation") || "unknown",
        spaceForUnitAndCylinder: f.get("spaceForUnitAndCylinder") || "unknown",
      },
    };
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Triage failed (${res.status})`);
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const field = { display: "block", margin: "0.25rem 0 0.75rem", width: "100%", padding: "0.4rem" } as const;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>Gary — customer triage</h1>
      <p style={{ color: "#555" }}>
        Internal tool. Enter the address and what you learned on the call; Gary gives a
        recommended next action and an <em>indicative</em> size band. Not a survey.
      </p>

      <form onSubmit={onSubmit}>
        <label>
          Address
          <input name="address" required style={field} placeholder="3 Orchard Close, Ottery St. Mary, EX11 1HT" />
        </label>
        <label>
          Floor area (m²)
          <input name="floorAreaM2" type="number" step="any" style={field} placeholder="206" />
        </label>
        <label>
          Wall type
          <select name="wallType" style={field} defaultValue="">
            <option value="">Unknown</option>
            <option value="cavity_filled">Cavity (filled)</option>
            <option value="cavity_unfilled">Cavity (unfilled)</option>
            <option value="solid">Solid</option>
            <option value="timber">Timber frame</option>
          </select>
        </label>
        <label>
          Glazing
          <select name="glazing" style={field} defaultValue="">
            <option value="">Unknown</option>
            <option value="double">Double</option>
            <option value="single">Single</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label>
          Age band
          <select name="ageBand" style={field} defaultValue="">
            <option value="">Unknown</option>
            <option value="pre_1950">Pre-1950</option>
            <option value="1950_2000">1950–2000</option>
            <option value="post_2000">Post-2000</option>
          </select>
        </label>
        <label>
          Main fuel
          <select name="mainFuel" style={field} defaultValue="">
            <option value="">Unknown</option>
            <option value="mains_gas">Mains gas</option>
            <option value="oil">Oil</option>
            <option value="lpg">LPG</option>
            <option value="electric">Electric</option>
            <option value="other">Other</option>
          </select>
        </label>
        {[
          ["ownerOccupier", "Owner-occupier?"],
          ["listedOrConservation", "Listed / conservation area?"],
          ["spaceForUnitAndCylinder", "Space for unit + cylinder?"],
        ].map(([name, text]) => (
          <label key={name}>
            {text}
            <select name={name} style={field} defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        ))}
        <button type="submit" disabled={loading} style={{ padding: "0.5rem 1rem" }}>
          {loading ? "Assessing…" : "Triage"}
        </button>
      </form>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {result && (
        <section style={{ marginTop: "1.5rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
          <h2>{label[result.nextAction] ?? result.nextAction}</h2>
          <p>
            Suitability: <strong>{result.suitability.replace("_", " ")}</strong> · confidence:{" "}
            {result.confidence}
          </p>
          {result.indicativeHeatPumpKw && (
            <p>
              Indicative heat pump:{" "}
              <strong>
                {result.indicativeHeatPumpKw.low}–{result.indicativeHeatPumpKw.high} kW
              </strong>
              {result.suggestedNominalKw ? ` (≈ ${result.suggestedNominalKw} kW nominal)` : ""}
            </p>
          )}
          {result.flags.length > 0 && (
            <ul>
              {result.flags.map((flag, i) => (
                <li key={i} style={{ color: sev[flag.severity] ?? "#333" }}>
                  {flag.message}
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary>Why</summary>
            <ul>
              {result.basis.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </main>
  );
}
