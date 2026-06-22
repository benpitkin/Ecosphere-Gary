import Anthropic from "@anthropic-ai/sdk";
import { resolveModel } from "@/gary/lib/reasoning";
import { SolarBrief, type SolarEnquiry, type SolarSizing } from "@/gary/contracts/solar";
import { SOLAR_SYSTEM_PROMPT, buildSolarUserMessage } from "@/gary/lib/solar/prompt";

/**
 * Claude reasoning layer for the solar pre-design brief.
 * =====================================================
 *
 * Calls Claude (Anthropic SDK) with the agent prompt + the enquiry + the
 * deterministic sizing, and returns a structured `SolarBrief`. The maths is
 * already done — this layer reads intent, narrates, and flags. It's gated on
 * `ANTHROPIC_API_KEY`: without it the orchestrator skips the brief rather than
 * failing (the deterministic sizing still stands on its own).
 *
 * Structured output is enforced via `output_config.format` (a JSON schema), and
 * the result is validated with our own zod schema. The model defaults to the
 * latest, most capable Claude model (`resolveModel()` → `claude-opus-4-8`,
 * overridable via `ANTHROPIC_MODEL`), with adaptive thinking.
 */

export function isSolarReasoningConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** JSON schema for SolarBrief (structured-output friendly: all required, no extra props). */
const SOLAR_BRIEF_SCHEMA = {
  type: "object",
  properties: {
    siteSummary: { type: "string" },
    systemRationale: { type: "string" },
    generationNote: { type: "string" },
    constraintsAndFlags: { type: "array", items: { type: "string" } },
    openQuestionsForSurvey: { type: "array", items: { type: "string" } },
    recommendedNextStep: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: [
    "siteSummary",
    "systemRationale",
    "generationNote",
    "constraintsAndFlags",
    "openQuestionsForSurvey",
    "recommendedNextStep",
    "confidence",
    "assumptions",
  ],
  additionalProperties: false,
} as const;

export interface SolarAgentDeps {
  /** Injectable for tests; defaults to a real Anthropic client's messages from env. */
  client?: Pick<Anthropic["messages"], "create">;
  /** Model override; defaults to resolveModel(). */
  model?: string;
}

export async function writeSolarBrief(
  enquiry: SolarEnquiry,
  sizing: SolarSizing,
  deps: SolarAgentDeps = {},
): Promise<SolarBrief> {
  const messages = deps.client ?? new Anthropic().messages;
  const model = deps.model ?? resolveModel();

  const response = await messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SOLAR_SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: SOLAR_BRIEF_SCHEMA } },
    messages: [{ role: "user", content: buildSolarUserMessage(enquiry, sizing) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Solar reasoning was refused by the safety classifier.");
  }
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) {
    throw new Error(`Solar reasoning returned no text (stop_reason: ${response.stop_reason}).`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Solar reasoning returned non-JSON output.");
  }
  // Validate against our own schema (source of truth for the shape).
  return SolarBrief.parse(parsed);
}
