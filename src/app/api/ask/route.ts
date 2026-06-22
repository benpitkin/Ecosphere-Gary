import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseAskInput } from "@/gary/contracts/ask";
import { askGary, isAskConfigured } from "@/gary/lib/ask";
import { requireApiKey } from "@/gary/lib/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/ask — technical Q&A with Gary.
 *
 * AskInput (question + optional history/jobContext) → AskResult (answer +
 * citations + confidence). Claude-powered, so it needs ANTHROPIC_API_KEY (503 if
 * missing). Reference glue — when Gary embeds in Core, Core calls `askGary`
 * directly from `@/gary`.
 */
export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;

  if (!isAskConfigured()) {
    return NextResponse.json(
      {
        error: "reasoning_unavailable",
        message: "Ask-Gary needs ANTHROPIC_API_KEY set on the server.",
      },
      { status: 503 },
    );
  }

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
    input = parseAskInput(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_ask_input", issues: err.issues }, { status: 422 });
    }
    throw err;
  }

  try {
    const result = await askGary(input);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "ask_failed", message: err instanceof Error ? err.message : "Failed to answer." },
      { status: 502 },
    );
  }
}
