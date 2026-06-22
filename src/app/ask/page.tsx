"use client";

import { useState } from "react";
import type { AskResult, AskTurn } from "@/gary/contracts/ask";

type Message = AskTurn & { citations?: AskResult["citations"]; confidence?: AskResult["confidence"] };

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [jobContext, setJobContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setError(null);
    setLoading(true);

    const history: AskTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, history, jobContext: jobContext.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Something went wrong.");
        setMessages((prev) => prev.slice(0, -1)); // drop the unanswered question
        return;
      }
      const result = data as AskResult;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, citations: result.citations, confidence: result.confidence },
      ]);
    } catch {
      setError("Network error — is the server running?");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 4 }}>Ask Gary</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Technical Q&amp;A — heat-pump design, emitter sizing, MCS, EcoSphere standards. Internal aid; advisory only.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "1.5rem 0" }}>
        {messages.length === 0 && (
          <p style={{ color: "#888" }}>
            e.g. &ldquo;Why is 45 °C the sweet spot?&rdquo;, &ldquo;What MWT do we design at?&rdquo;, &ldquo;When do we
            keep vs replace a radiator?&rdquo;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: m.role === "user" ? "#e0edff" : "#f4f4f5",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 14px",
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
            {m.role === "assistant" && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
                {m.confidence && <span>confidence: {m.confidence}</span>}
                {m.citations && m.citations.length > 0 && (
                  <span> · sources: {m.citations.map((c) => c.source).join(", ")}</span>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && <div style={{ color: "#888" }}>Gary is thinking…</div>}
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <details style={{ fontSize: 14 }}>
          <summary style={{ cursor: "pointer", color: "#555" }}>Add job context (optional)</summary>
          <textarea
            value={jobContext}
            onChange={(e) => setJobContext(e.target.value)}
            placeholder="Paste a design summary, survey figures, etc. to ground the answer."
            rows={4}
            style={{ width: "100%", marginTop: 6, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </details>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a technical question…"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc" }}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: loading || !question.trim() ? "#9ca3af" : "#2563eb",
              color: "white",
              cursor: loading || !question.trim() ? "default" : "pointer",
            }}
          >
            Ask
          </button>
        </div>
      </form>
    </main>
  );
}
