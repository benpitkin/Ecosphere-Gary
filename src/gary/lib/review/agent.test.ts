import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { reviewDesignQuote, REVIEW_DISCLAIMER } from "@/gary/lib/review";
import { parseReviewInput, type ReviewSuggestions } from "@/gary/contracts/review";

const suggestions: ReviewSuggestions = {
  summary: "Solid design; one room emitter is light.",
  suggestions: ["Uprate the Study emitter or drop flow temp.", "Confirm the cylinder line on the quote."],
  confidence: "medium",
};

const mockClient = (text: string, stop = "end_turn") =>
  ({
    create: vi.fn(async () => ({ stop_reason: stop, content: [{ type: "text", text }] })),
  }) as unknown as Pick<Anthropic["messages"], "create">;

const input = parseReviewInput({
  design: {
    wholeHouseHeatLossKw: 5.65,
    flowTempC: 45,
    heatPump: { capacityAtDesignKw: 7.54 },
    mcs031Present: true,
    rooms: [{ name: "Study", heatLossW: 600, roomTempC: 21, emitters: [{ type: "radiator", status: "new", outputW: 400 }] }],
  },
});

describe("design/quote reviewer orchestrator", () => {
  it("runs deterministic checks and attaches suggestions when a client is supplied", async () => {
    const client = mockClient(JSON.stringify(suggestions));
    const result = await reviewDesignQuote(input, { client, model: "claude-opus-4-8" });
    expect(result.verdict).toBe("review"); // undersized room → warning
    expect(result.findings.some((f) => f.code === "emitter_undersized")).toBe(true);
    expect(result.suggestions?.suggestions.length).toBeGreaterThan(0);
    expect(result.disclaimer).toBe(REVIEW_DISCLAIMER);
  });

  it("returns findings with null suggestions when reasoning is skipped", async () => {
    const result = await reviewDesignQuote(input, { skipSuggestions: true });
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.suggestions).toBeNull();
  });

  it("rejects a refusal from the model", async () => {
    const client = mockClient("", "refusal");
    const { writeReviewSuggestions } = await import("@/gary/lib/review");
    const { runReviewChecks } = await import("@/gary/lib/review");
    await expect(writeReviewSuggestions(input, runReviewChecks(input), { client })).rejects.toThrow(/refus/i);
  });
});
