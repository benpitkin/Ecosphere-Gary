"use client";

/**
 * Ask-Gary floating chat widget.
 * ==============================
 *
 * A self-contained bottom-right chat bubble that talks to `POST /api/ask`. Built
 * to replace Core's existing bottom-right AI assistant: drop this component into
 * Core's root layout and point `endpoint` at Gary's `/api/ask` (or an in-process
 * route when Gary is embedded). The icon is a "little man".
 *
 * Self-contained on purpose (only React + the AskResult shape), so Core can copy
 * it as-is. No Gary-internal imports beyond the response type.
 */

import { useEffect, useRef, useState } from "react";
import type { AskResult, AskTurn } from "@/gary/contracts/ask";

type Message = AskTurn & {
  citations?: AskResult["citations"];
  confidence?: AskResult["confidence"];
  pending?: boolean;
  errored?: boolean;
};

/** A simple "little man" (head + shoulders) silhouette. */
function LittleMan({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" fill="currentColor" />
    </svg>
  );
}

export interface AskGaryWidgetProps {
  /** API endpoint; defaults to this app's /api/ask. */
  endpoint?: string;
  /** Greeting shown when the panel first opens. */
  greeting?: string;
  /** Accent colour for the launcher + user bubbles. */
  accent?: string;
}

export default function AskGaryWidget({
  endpoint = "/api/ask",
  greeting = "Hi, I'm Gary. Ask me anything technical — heat-pump design, emitter sizing, MCS, EcoSphere standards.",
  accent = "#2563eb",
}: AskGaryWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);

    const history: AskTurn[] = messages
      .filter((m) => !m.errored && !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
      { role: "assistant", content: "…", pending: true },
    ]);
    setQuestion("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      setMessages((prev) => {
        const next = prev.slice(0, -1); // drop the pending placeholder
        if (!res.ok) {
          next.push({
            role: "assistant",
            content: data?.message ?? "Sorry, something went wrong.",
            errored: true,
          });
        } else {
          const r = data as AskResult;
          next.push({
            role: "assistant",
            content: r.answer,
            citations: r.citations,
            confidence: r.confidence,
          });
        }
        return next;
      });
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Network error — please try again.", errored: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000, fontFamily: "system-ui, sans-serif" }}>
      {open && (
        <div
          style={{
            width: 360,
            maxWidth: "calc(100vw - 40px)",
            height: 520,
            maxHeight: "calc(100vh - 120px)",
            display: "flex",
            flexDirection: "column",
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: accent,
              color: "white",
            }}
          >
            <LittleMan size={22} />
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", lineHeight: 1.1 }}>Gary</strong>
              <span style={{ fontSize: 11, opacity: 0.85 }}>EcoSphere design assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: "transparent", border: "none", color: "white", fontSize: 20, cursor: "pointer" }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ alignSelf: "flex-start", maxWidth: "85%", background: "#f4f4f5", borderRadius: 12, padding: "9px 12px", fontSize: 14 }}>
              {greeting}
            </div>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: m.role === "user" ? accent : m.errored ? "#fef2f2" : "#f4f4f5",
                  color: m.role === "user" ? "white" : m.errored ? "#b91c1c" : "inherit",
                  borderRadius: 12,
                  padding: "9px 12px",
                  fontSize: 14,
                  whiteSpace: "pre-wrap",
                  fontStyle: m.pending ? "italic" : "normal",
                  opacity: m.pending ? 0.7 : 1,
                }}
              >
                {m.content}
                {m.role === "assistant" && !m.pending && !m.errored && (m.confidence || (m.citations && m.citations.length > 0)) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
                    {m.confidence && <span>confidence: {m.confidence}</span>}
                    {m.citations && m.citations.length > 0 && (
                      <span> · sources: {m.citations.map((c) => c.source).join(", ")}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Composer */}
          <form onSubmit={send} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid #eee" }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask Gary…"
              style={{ flex: 1, padding: "9px 11px", borderRadius: 10, border: "1px solid #ccc", fontSize: 14 }}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              style={{
                padding: "0 14px",
                borderRadius: 10,
                border: "none",
                background: loading || !question.trim() ? "#9ca3af" : accent,
                color: "white",
                cursor: loading || !question.trim() ? "default" : "pointer",
                fontSize: 14,
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Launcher — the little man */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Gary" : "Ask Gary"}
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          border: "none",
          background: accent,
          color: "white",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: "auto",
        }}
      >
        <LittleMan size={30} />
      </button>
    </div>
  );
}
