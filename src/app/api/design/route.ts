import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseSurveyObject } from "@/contracts/survey";
import { designOptions } from "@/lib/engine";
import { requireApiKey } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/design — the stable entry point Core calls.
 *
 * SurveyObject in → DesignResult out. A malformed survey is rejected with 422; a
 * well-formed one is run through the deterministic engine, which returns the
 * three options with per-option review flags. NOTE: until the MCS031 Issue 4.0
 * method and the Stelrad catalogue are supplied, results carry blocker-severity
 * `reviewFlags` (mcs031_provisional, stelrad_catalogue_pending) — callers must
 * treat them as provisional, not sign-off-ready.
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

  let survey;
  try {
    survey = parseSurveyObject(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_survey_object", issues: err.issues },
        { status: 422 },
      );
    }
    throw err;
  }

  const result = designOptions(survey);
  return NextResponse.json(result, { status: 200 });
}
