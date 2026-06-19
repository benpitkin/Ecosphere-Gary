"use client";

import { useState } from "react";
import type { DesignResult, DesignOption } from "@/contracts/design";
import type { SurveyObject } from "@/contracts/survey";

const sev: Record<string, string> = {
  info: "#2563eb",
  warning: "#b45309",
  blocker: "#b91c1c",
};

const optionLabel: Record<string, string> = {
  eco: "Eco",
  sweet_spot: "Sweet spot",
  budget: "Budget",
};

type DesignResponse = { survey: SurveyObject; result: DesignResult };

const gbp = (n: number) => `£${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const kwh = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`;

function OptionCard({ option, recommended }: { option: DesignOption; recommended: boolean }) {
  const p = option.performance;
  const counts = option.emitters.reduce(
    (acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  return (
    <div
      style={{
        border: recommended ? "2px solid #15803d" : "1px solid #ddd",
        borderRadius: 8,
        padding: "1rem",
        flex: "1 1 240px",
        minWidth: 240,
      }}
    >
      <h3 style={{ margin: "0 0 0.25rem" }}>
        {optionLabel[option.key] ?? option.key} — {option.flowTempC} °C
        {recommended && <span style={{ color: "#15803d", fontSize: "0.8rem" }}> ★ recommended</span>}
      </h3>
      <p style={{ margin: "0.25rem 0", color: "#555", fontSize: "0.9rem" }}>
        {option.heatPump.manufacturer} {option.heatPump.model}
        <br />
        {option.heatPump.capacityAtDesignKw} kW · cover {Math.round(option.heatPump.coverRatio * 100)}% · SCOP{" "}
        {option.heatPump.scop}
      </p>
      <table style={{ fontSize: "0.85rem", borderCollapse: "collapse", width: "100%" }}>
        <tbody>
          <tr><td>SPF</td><td style={{ textAlign: "right" }}>{p.spf}</td></tr>
          <tr><td>Heating</td><td style={{ textAlign: "right" }}>{kwh(p.annualHeatingKwh)}</td></tr>
          <tr><td>Hot water</td><td style={{ textAlign: "right" }}>{kwh(p.annualDhwKwh)}</td></tr>
          <tr><td>Running cost</td><td style={{ textAlign: "right" }}>{gbp(p.annualRunningCostGbp)}/yr</td></tr>
          <tr><td>Carbon</td><td style={{ textAlign: "right" }}>{Math.round(p.annualCarbonKgCo2e)} kg/yr</td></tr>
        </tbody>
      </table>
      <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
        Emitters: {counts.keep ?? 0} keep · {counts.replacement ?? 0} replace · {counts.new ?? 0} new
      </p>
      <details style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
        <summary>Per-room</summary>
        <ul style={{ paddingLeft: "1rem" }}>
          {option.emitters.map((e, i) => (
            <li key={i}>
              <strong>{e.room}</strong> ({e.status}): {e.specification} — {Math.round(e.providedOutputW)} W
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export default function DesignPage() {
  const [data, setData] = useState<DesignResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/design/from-pdf", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? `Design failed (${res.status})`);
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const blockers = data?.result.reviewFlags.filter((f) => f.severity === "blocker") ?? [];

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 980 }}>
      <h1>Gary — design options</h1>
      <p style={{ color: "#555" }}>
        Internal tool. Drop in a completed Spruce survey PDF; Gary parses it and produces the three
        options (40 / 45 / 50 °C) for you to check.
      </p>

      <form onSubmit={onSubmit}>
        <input name="file" type="file" accept="application/pdf,.pdf" required />
        <button type="submit" disabled={loading} style={{ marginLeft: "0.75rem", padding: "0.5rem 1rem" }}>
          {loading ? "Designing…" : "Generate options"}
        </button>
      </form>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {data && (
        <section style={{ marginTop: "1.5rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
          <p>
            <strong>{data.survey.property.address}</strong> · whole-house heat loss{" "}
            {(data.survey.wholeHouse.heatLossW / 1000).toFixed(2)} kW · {data.survey.rooms.length} rooms ·
            recommended: <strong>{optionLabel[data.result.recommended] ?? data.result.recommended}</strong>
          </p>

          {blockers.length > 0 && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                margin: "0.5rem 0 1rem",
              }}
            >
              <strong style={{ color: "#b91c1c" }}>Provisional — not sign-off-ready:</strong>
              <ul style={{ margin: "0.25rem 0 0" }}>
                {blockers.map((f, i) => (
                  <li key={i} style={{ color: sev.blocker }}>{f.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {data.result.options.map((o) => (
              <OptionCard key={o.key} option={o} recommended={o.key === data.result.recommended} />
            ))}
          </div>

          {data.result.reviewFlags.filter((f) => f.severity !== "blocker").length > 0 && (
            <>
              <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>Review flags</h2>
              <ul>
                {data.result.reviewFlags
                  .filter((f) => f.severity !== "blocker")
                  .map((f, i) => (
                    <li key={i} style={{ color: sev[f.severity] ?? "#333" }}>{f.message}</li>
                  ))}
              </ul>
            </>
          )}

          <details style={{ marginTop: "1rem" }}>
            <summary>Audit trace</summary>
            <ul style={{ fontSize: "0.85rem" }}>
              {data.result.auditTrace.map((a, i) => (
                <li key={i}>
                  <strong>{a.step}:</strong> {a.detail}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </main>
  );
}
