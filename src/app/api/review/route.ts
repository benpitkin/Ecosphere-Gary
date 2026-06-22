import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseReviewInput } from "@/gary/contracts/review";
import { reviewDesignQuote } from "@/gary/lib/review";
import { requireApiKey } from "@/gary/lib/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/review — design & quote reviewer.
 *
 * ReviewInput (a prepared design + optional quote) → ReviewResult (verdict +
 * deterministic findings + AI suggestions when ANTHROPIC_API_KEY is set).
 * Internal review aid; not a substitute for the designer's sign-off. This route
 * is reference glue — when Gary embeds in Core, Core calls `reviewDesignQuote`
 * directly from `@/gary`.
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

  let input;
  try {
    input = parseReviewInput(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_review_input", issues: err.issues }, { status: 422 });
    }
    throw err;
  }

  try {
    const result = await reviewDesignQuote(input);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // Suggestions failed; the deterministic review still stands.
    const result = await reviewDesignQuote(input, { skipSuggestions: true });
    return NextResponse.json(
      {
        ...result,
        error: "suggestions_failed",
        message: err instanceof Error ? err.message : "Suggestions failed; findings returned without them.",
      },
      { status: 200 },
    );
  }
}
