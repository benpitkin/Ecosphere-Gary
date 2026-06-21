import Link from "next/link";

const tools = [
  {
    href: "/triage",
    title: "Customer triage",
    desc: "Address + call notes → recommended next action and an indicative heat-pump size band. Runs before a survey.",
  },
  {
    href: "/design",
    title: "Heat-pump design",
    desc: "Drop in a completed Spruce survey PDF → three compliant, costed options at 40 / 45 / 50 °C.",
  },
  {
    href: "/solar",
    title: "Solar pre-design",
    desc: "Enquiry → indicative solar pre-design brief (sizing, generation, DNO/G99) to review before a full OpenSolar design.",
  },
];

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 760 }}>
      <h1>Gary — EcoSphere design agent</h1>
      <p style={{ color: "#555" }}>
        Internal tools. Gary is a standalone engine: heat-pump design, customer triage,
        and solar pre-design. Not customer-facing.
      </p>

      <div style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: "block",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "1rem",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <strong style={{ fontSize: "1.1rem" }}>{t.title}</strong>
            <span style={{ color: "#666", fontSize: "0.7rem", float: "right" }}>{t.href}</span>
            <p style={{ margin: "0.35rem 0 0", color: "#555", fontSize: "0.9rem" }}>{t.desc}</p>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: "1.5rem", color: "#888", fontSize: "0.85rem" }}>
        Design owned by Gary · pricing owned by Core · readiness at <code>/api/health</code>.
      </p>
    </main>
  );
}
