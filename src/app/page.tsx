import { OPTION_TIERS, OPTION_COUNT, REASONING } from "@/config/decisions";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 720 }}>
      <h1>Gary</h1>
      <p>Ecosphere Energy&apos;s quoting and system-design assistant.</p>
      <p>
        <strong>Phase 0 scaffold.</strong> The foundation is in place; the
        quoting flow is built out in later phases.
      </p>
      <ul>
        <li>Reasoning layer: {REASONING.mode}</li>
        <li>
          Options offered: {OPTION_COUNT} fixed tiers ({OPTION_TIERS.join(" / ")})
        </li>
        <li>BOM quantities owned by Gary · prices owned by Core</li>
      </ul>
    </main>
  );
}
