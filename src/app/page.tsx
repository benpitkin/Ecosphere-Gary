import { OPTIONS, OPTION_COUNT, DEFAULT_OPTION } from "@/config/decisions";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 760 }}>
      <h1>Gary — EcoSphere Heat Pump Design Agent</h1>
      <p>
        Takes a completed Spruce survey and produces three compliant, costed design
        options at three flow temperatures, ready for Ben to check and pull into a
        Core proposal. Not customer-facing.
      </p>
      <p>
        <strong>Phase 0 scaffold.</strong> Contracts, API surface and module stubs
        are in place; the deterministic calc engine and reasoning layer come in
        later phases.
      </p>
      <ul>
        {OPTIONS.map((o) => (
          <li key={o.key}>
            <strong>{o.key.replace("_", " ")}</strong> — {o.flowTempC} °C flow,{" "}
            {o.radiators} radiators, {o.capitalRank} capital
            {o.key === DEFAULT_OPTION ? " (default)" : ""}
          </li>
        ))}
      </ul>
      <p>
        Always {OPTION_COUNT} options. Design owned by Gary · pricing owned by Core.
      </p>
    </main>
  );
}
