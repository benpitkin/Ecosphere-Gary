import { NextResponse } from "next/server";
import { parseSprucePdf } from "@/gary/lib/ingestion/sprucePdf";
import { designOptions } from "@/gary/lib/engine";
import { requireApiKey } from "@/gary/lib/apiAuth";

export const dynamic = "force-dynamic";
// pdf-parse runs on Node (Buffer), not the Edge runtime.
export const runtime = "nodejs";

/**
 * POST /api/design/from-pdf — convenience endpoint for the internal /design page.
 *
 * Multipart form with a `file` (a Spruce report PDF) → parse to a SurveyObject →
 * run the deterministic engine. Returns `{ survey, result }` so the page can show
 * both what was read and the three options. The stable machine interface Core
 * calls remains the JSON `POST /api/design`; this just chains parse + design for
 * a human dropping in a PDF.
 *
 * NOTE: `result.reviewFlags` will include blocker-severity items
 * (mcs031_provisional, stelrad_catalogue_pending) until that data is supplied —
 * the page surfaces them; treat the output as provisional, not sign-off-ready.
 */
export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "no_file", message: "Upload a Spruce report PDF as form field 'file'." },
      { status: 400 },
    );
  }

  let survey;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    survey = await parseSprucePdf(buffer);
  } catch (err) {
    return NextResponse.json(
      {
        error: "parse_failed",
        message: err instanceof Error ? err.message : "Could not parse the PDF.",
      },
      { status: 422 },
    );
  }

  try {
    const result = designOptions(survey);
    return NextResponse.json({ survey, result }, { status: 200 });
  } catch (err) {
    // The PDF parsed but the engine couldn't design from it — return the survey
    // and a structured error rather than an opaque 500, since the input is an
    // arbitrary uploaded file.
    return NextResponse.json(
      {
        error: "design_failed",
        message: err instanceof Error ? err.message : "Could not produce a design.",
        survey,
      },
      { status: 422 },
    );
  }
}
