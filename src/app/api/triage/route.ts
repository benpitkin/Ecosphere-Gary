import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseTriageInput } from "@/gary/contracts/triage";
import { triage } from "@/gary/lib/triage";
import { requireApiKey } from "@/gary/lib/apiAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/triage — front-of-funnel triage.
 *
 * TriageInput (address + qualifying answers) in → TriageResult out. Internal:
 * used by the staff tool today; a website chatbot could reuse it later.
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

  try {
    const input = parseTriageInput(body);
    return NextResponse.json(triage(input), { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "invalid_triage_input", issues: err.issues },
        { status: 422 },
      );
    }
    throw err;
  }
}
