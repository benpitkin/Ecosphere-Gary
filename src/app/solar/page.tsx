"use client";

import { useState } from "react";
import type { SolarPreDesign } from "@/contracts/solar";

const sev: Record<string, string> = {
  info: "#2563eb",
  warning: "#b45309",
  blocker: "#b91c1c",
};

export default function SolarPage() {
  const [result, setResult] = useState<SolarPreDesign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    const f = new FormData(e.currentTarget);
    // Only emit a finite number; junk input becomes undefined (omitted), not NaN.
    const numOrUndef = (v: FormDataEntryValue | null) => {
      if (!v || String(v).trim() === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const str = (v: FormDataEntryValue | null) => (v && String(v).trim() !== "" ? String(v) : undefined);

    // Build a single roof face only if anything about it was entered (a pitch or
    // area of 0 still counts — `!== undefined`, not truthiness).
    const orientation = str(f.get("orientation"));
    const pitch = numOrUndef(f.get("pitchDeg"));
    const area = numOrUndef(f.get("areaM2"));
    const shading = str(f.get("shading"));
    const roofFaces =
      orientation !== undefined || pitch !== undefined || area !== undefined || shading !== undefined
        ? [{ orientation: orientation ?? "unknown", pitchDeg: pitch, areaM2: area, shading: shading ?? "unknown" }]
        : [];

    const body = {
      address: String(f.get("address") ?? ""),
      annualConsumptionKwh: numOrUndef(f.get("annualConsumptionKwh")),
      occupants: numOrUndef(f.get("occupants")),
      hasEv: f.get("hasEv") === "on",
      hasHeatPump: f.get("hasHeatPump") === "on",
      wantsBattery: f.get("wantsBattery") === "on",
      phase: str(f.get("phase")) ?? "unknown",
      listedOrConservation: str(f.get("listedOrConservation")) ?? "unknown",
      roofFaces,
      goals: str(f.get("goals")),
      notes: str(f.get("notes")),
    };

    try {
      const res = await fetch("/api/solar/pre-design", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? `Pre-design failed (${res.status})`);
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const field = { display: "block", margin: "0.25rem 0 0.75rem", width: "100%", padding: "0.4rem" } as const;
  const s = result?.sizing;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 820 }}>
      <h1>Gary — solar pre-design</h1>
      <p style={{ color: "#555" }}>
        Internal tool. Enter what you know from the enquiry; Gary produces an <em>indicative</em>{" "}
        pre-design brief to review before a full OpenSolar design. Not a quote.
      </p>

      <form onSubmit={onSubmit}>
        <label>
          Address
          <input name="address" required style={field} placeholder="3 Orchard Close, Ottery St. Mary, EX11 1HT" />
        </label>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label style={{ flex: 1 }}>
            Annual electricity use (kWh)
            <input name="annualConsumptionKwh" type="number" step="any" style={field} placeholder="4000" />
          </label>
          <label style={{ flex: 1 }}>
            Occupants
            <input name="occupants" type="number" style={field} placeholder="3" />
          </label>
        </div>
        <fieldset style={{ margin: "0 0 0.75rem", border: "1px solid #ddd", borderRadius: 6, padding: "0.5rem 0.75rem" }}>
          <legend style={{ fontSize: "0.85rem", color: "#555" }}>Main roof face</legend>
          <div style={{ display: "flex", gap: "1rem" }}>
            <label style={{ flex: 1 }}>
              Orientation
              <select name="orientation" style={field} defaultValue="">
                <option value="">Unknown</option>
                {["S", "SE", "SW", "E", "W", "NE", "NW", "N"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Pitch (°)
              <input name="pitchDeg" type="number" style={field} placeholder="35" />
            </label>
            <label style={{ flex: 1 }}>
              Usable area (m²)
              <input name="areaM2" type="number" step="any" style={field} placeholder="20" />
            </label>
            <label style={{ flex: 1 }}>
              Shading
              <select name="shading" style={field} defaultValue="">
                <option value="">Unknown</option>
                {["none", "light", "moderate", "heavy"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label style={{ flex: 1 }}>
            Supply phase
            <select name="phase" style={field} defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="single">Single-phase</option>
              <option value="three">Three-phase</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Listed / conservation?
            <select name="listedOrConservation" style={field} defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
        </div>
        <label style={{ display: "block", margin: "0.25rem 0" }}>
          <input type="checkbox" name="hasEv" /> Has / wants an EV
        </label>
        <label style={{ display: "block", margin: "0.25rem 0" }}>
          <input type="checkbox" name="hasHeatPump" /> Has / wants a heat pump
        </label>
        <label style={{ display: "block", margin: "0.25rem 0 0.75rem" }}>
          <input type="checkbox" name="wantsBattery" /> Interested in battery storage
        </label>
        <label>
          Customer goals (free text)
          <textarea name="goals" style={{ ...field, height: 60 }} placeholder="Lower bills, some backup during power cuts…" />
        </label>
        <label>
          Notes
          <textarea name="notes" style={{ ...field, height: 50 }} />
        </label>
        <button type="submit" disabled={loading} style={{ padding: "0.5rem 1rem" }}>
          {loading ? "Designing…" : "Generate pre-design"}
        </button>
      </form>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {result && s && (
        <section style={{ marginTop: "1.5rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>
            {result.disclaimer}
          </div>

          <h2 style={{ fontSize: "1.2rem" }}>Proposed system</h2>
          <table style={{ borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <tbody>
              <tr><td style={{ paddingRight: "1.5rem" }}>System size</td><td><strong>{s.recommendedKwp} kWp</strong> ({s.panelCount} × {s.panelWatt} W)</td></tr>
              <tr><td>Inverter</td><td>{s.inverterKw} kW</td></tr>
              <tr><td>Battery</td><td>{s.batteryKwh ? `${s.batteryKwh} kWh` : "none recommended"}</td></tr>
              <tr><td>Est. generation</td><td>{s.estimatedAnnualGenerationKwh.toLocaleString()} kWh/yr ({s.specificYieldKwhPerKwp} kWh/kWp)</td></tr>
              <tr><td>Est. consumption</td><td>{s.estimatedAnnualConsumptionKwh.toLocaleString()} kWh/yr · offset ~{s.consumptionOffsetPct}%</td></tr>
              <tr><td>Self-consumption</td><td>~{s.selfConsumptionPct}%</td></tr>
              <tr><td>DNO</td><td>{s.dno.g99Required ? "G99 prior approval required" : "G98 notification"} (limit {s.dno.perPhaseLimitKw} kW/phase)</td></tr>
              <tr><td>Sizing basis</td><td>{s.sizingBasis.replace("_", " ")}</td></tr>
            </tbody>
          </table>

          {s.flags.length > 0 && (
            <>
              <h3 style={{ fontSize: "1rem", marginTop: "1rem" }}>Flags</h3>
              <ul>
                {s.flags.map((flag, i) => (
                  <li key={i} style={{ color: sev[flag.severity] ?? "#333" }}>{flag.message}</li>
                ))}
              </ul>
            </>
          )}

          {result.brief ? (
            <>
              <h2 style={{ fontSize: "1.2rem", marginTop: "1.5rem" }}>Brief</h2>
              <p><strong>Site:</strong> {result.brief.siteSummary}</p>
              <p><strong>System rationale:</strong> {result.brief.systemRationale}</p>
              <p><strong>Generation:</strong> {result.brief.generationNote}</p>
              <p><strong>Confidence:</strong> {result.brief.confidence}</p>
              <h3 style={{ fontSize: "1rem" }}>Constraints &amp; flags</h3>
              <ul>{result.brief.constraintsAndFlags.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <h3 style={{ fontSize: "1rem" }}>Open questions for survey</h3>
              <ul>{result.brief.openQuestionsForSurvey.map((x, i) => <li key={i}>{x}</li>)}</ul>
              <p><strong>Recommended next step:</strong> {result.brief.recommendedNextStep}</p>
              <details>
                <summary>Assumptions</summary>
                <ul>{result.brief.assumptions.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </details>
            </>
          ) : (
            <p style={{ marginTop: "1rem", color: "#555" }}>
              <em>Written brief not generated — set <code>ANTHROPIC_API_KEY</code> to enable the reasoning layer.
              Deterministic sizing above stands on its own.</em>
            </p>
          )}
        </section>
      )}
    </main>
  );
}
