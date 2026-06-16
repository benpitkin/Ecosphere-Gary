import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseSurveyObject } from "@/contracts/survey";
import { designOptions, NotImplementedError } from "@/lib/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/design — the stable entry point Core calls.
 *
 * SurveyObject in → DesignResult out. Phase 0 validates the input against the
 * contract and then returns 501, because the deterministic calc engine (Phase 3)
 * is not built yet. This makes the interface real and testable now: a malformed
 * survey is rejected with 422; a well-formed one reaches the (pending) engine.
 */
export async function POST(request: Request) {
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

  try {
    const result = designOptions(survey);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof NotImplementedError) {
      return NextResponse.json(
        { error: "not_implemented", message: err.message },
        { status: 501 },
      );
    }
    throw err;
  }
}
