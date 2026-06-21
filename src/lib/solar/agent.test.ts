import { describe, it, expect, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { writeSolarBrief } from "@/lib/solar/agent";
import { solarPreDesign, SOLAR_DISCLAIMER } from "@/lib/solar";
import { sizeSolar } from "@/lib/solar/sizing";
import { parseSolarEnquiry, type SolarBrief } from "@/contracts/solar";

const briefObj: SolarBrief = {
  siteSummary: "South-facing roof in Devon, ~35° pitch, no shading assumed.",
  systemRationale: "3.96 kWp (9 panels) sized to roughly match 4000 kWh annual use.",
  generationNote: "~3960 kWh/yr indicative, ~30% self-consumed — pre-survey only.",
  constraintsAndFlags: ["Structural check required.", "Confirm shading on survey."],
  openQuestionsForSurvey: ["Exact roof orientation and pitch?", "Any shading?"],
  recommendedNextStep: "Book a survey.",
  confidence: "medium",
  assumptions: ["South-facing, no shading.", "Single phase."],
};

const mockClient = (text: string, stop: string = "end_turn") =>
  ({
    create: vi.fn(async () => ({
      stop_reason: stop,
      content: [{ type: "text", text }],
    })),
  }) as unknown as Pick<Anthropic["messages"], "create">;

const enquiry = parseSolarEnquiry({
  address: "1 Test St, Devon",
  annualConsumptionKwh: 4000,
  roofFaces: [{ orientation: "S", pitchDeg: 35, shading: "none" }],
});

describe("solar reasoning layer", () => {
  it("calls the model and validates the structured brief", async () => {
    const client = mockClient(JSON.stringify(briefObj));
    const sizing = sizeSolar(enquiry);
    const brief = await writeSolarBrief(enquiry, sizing, { client, model: "claude-opus-4-8" });

    expect(brief.confidence).toBe("medium");
    expect(brief.openQuestionsForSurvey.length).toBeGreaterThan(0);
    const createMock = (client.create as ReturnType<typeof vi.fn>);
    const args = createMock.mock.calls[0][0];
    expect(args.model).toBe("claude-opus-4-8");
    expect(args.output_config.format.type).toBe("json_schema");
    expect(args.system).toContain("EcoSphere");
  });

  it("rejects a refusal stop reason", async () => {
    const client = mockClient("", "refusal");
    await expect(writeSolarBrief(enquiry, sizeSolar(enquiry), { client })).rejects.toThrow(/refus/i);
  });

  it("rejects non-JSON model output", async () => {
    const client = mockClient("not json at all");
    await expect(writeSolarBrief(enquiry, sizeSolar(enquiry), { client })).rejects.toThrow(/non-JSON/);
  });
});

describe("solar pre-design orchestrator", () => {
  it("returns sizing + brief when a client is supplied", async () => {
    const client = mockClient(JSON.stringify(briefObj));
    const result = await solarPreDesign(enquiry, { client, model: "claude-opus-4-8" });
    expect(result.address).toBe("1 Test St, Devon");
    expect(result.sizing.recommendedKwp).toBeGreaterThan(0);
    expect(result.brief?.recommendedNextStep).toBe("Book a survey.");
    expect(result.disclaimer).toBe(SOLAR_DISCLAIMER);
  });

  it("returns sizing with a null brief when reasoning is skipped", async () => {
    const result = await solarPreDesign(enquiry, { skipBrief: true });
    expect(result.sizing.recommendedKwp).toBeGreaterThan(0);
    expect(result.brief).toBeNull();
  });
});
