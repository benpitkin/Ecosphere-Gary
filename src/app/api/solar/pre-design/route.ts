import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseSolarEnquiry } from "@/gary/contracts/solar";
import { solarPreDesign } from "@/gary/lib/solar";
import { requireApiKey } from "@/gary/lib/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/solar/pre-design — the EcoSphere Solar Pre-Design Agent entry point.
 *
 * SolarEnquiry in → SolarPreDesign out. Always returns the deterministic sizing;
 * includes the Claude-written brief when ANTHROPIC_API_KEY is set. Internal:
 * Ben/Natasha review the brief before committing to a full OpenSolar design.
 * Output is indicative pre-survey, never a quote.
 */
export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  let enquiry;
  try {
    enquiry = parseSolarEnquiry(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_solar_enquiry", issues: err.issues }, { status: 422 });
    }
    throw err;
  }

  try {
    const result = await solarPreDesign(enquiry);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // The deterministic sizing is sound; a reasoning-layer failure shouldn't 500
    // opaquely — return the sizing with an error note. Guard the recovery too so
    // an unexpected sizing error still yields a structured response, not a 500.
    try {
      const result = await solarPreDesign(enquiry, { skipBrief: true });
      return NextResponse.json(
        {
          ...result,
          error: "reasoning_failed",
          message: err instanceof Error ? err.message : "Brief generation failed; sizing returned without it.",
        },
        { status: 200 },
      );
    } catch (sizingErr) {
      return NextResponse.json(
        {
          error: "sizing_failed",
          message: sizingErr instanceof Error ? sizingErr.message : "Could not produce a pre-design.",
        },
        { status: 500 },
      );
    }
  }
}
