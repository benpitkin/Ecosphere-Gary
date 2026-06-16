import type { SurveyObject } from "@/contracts/survey";
import { NotImplementedError } from "@/lib/engine";

/**
 * Ingestion adapters (Phases 1–2).
 * ================================
 *
 * The agent never talks to Spruce directly — it consumes a normalised
 * `SurveyObject`. Adapters turn a concrete source into that object. The PDF
 * adapter is the default path (Spruce API is POST-only, so completed surveys
 * arrive as PDFs).
 *
 * Phase 0 ships the interface + a stub. The real PDF parser (Phase 2) is
 * table-aware (see CLAUDE.md "PDF parser gotchas") and is built against the
 * 3 Orchard Close golden fixture.
 */

export interface SurveyAdapter {
  readonly source: "pdf" | "api";
  parse(input: Uint8Array | unknown): Promise<SurveyObject>;
}

export const pdfAdapter: SurveyAdapter = {
  source: "pdf",
  async parse(_input: Uint8Array | unknown): Promise<SurveyObject> {
    throw new NotImplementedError("Spruce PDF parser (Phase 2)");
  },
};
