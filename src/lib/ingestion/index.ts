import type { SurveyObject } from "@/contracts/survey";
import { parseSprucePdf } from "@/lib/ingestion/sprucePdf";

/**
 * Ingestion adapters (Phases 1–2).
 * ================================
 *
 * The agent never talks to Spruce directly — it consumes a normalised
 * `SurveyObject`. Adapters turn a concrete source into that object. The PDF
 * adapter is the default path (Spruce API is POST-only, so completed surveys
 * arrive as PDFs) and is implemented in `sprucePdf.ts`, validated against the
 * 3 Orchard Close golden fixture.
 */

export interface SurveyAdapter {
  readonly source: "pdf" | "api";
  parse(input: Uint8Array | unknown): Promise<SurveyObject>;
}

export const pdfAdapter: SurveyAdapter = {
  source: "pdf",
  async parse(input: Uint8Array | unknown): Promise<SurveyObject> {
    if (!(input instanceof Uint8Array)) {
      throw new TypeError("pdfAdapter.parse expects PDF bytes (Uint8Array/Buffer).");
    }
    return parseSprucePdf(input);
  },
};
