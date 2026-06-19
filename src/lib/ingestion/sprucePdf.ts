import pdfParse from "pdf-parse";
import {
  SURVEY_OBJECT_VERSION,
  parseSurveyObject,
  type SurveyObject,
} from "@/contracts/survey";

/**
 * Spruce heat-loss report → SurveyObject (Phase 2).
 * =================================================
 *
 * `parseSprucePdf(buffer)` extracts text with `pdf-parse` (pure-JS, runs on
 * Vercel) and hands it to `parseSprucePdfText`, which does the table-aware
 * parsing. Splitting the two keeps the parsing logic pure and unit-testable, and
 * lets us validate it against the 3 Orchard Close golden fixture.
 *
 * Scope (v1): the core SurveyObject — design conditions, whole-house figures,
 * the room-by-room table (with floor assignment), the surveyed heat pump, the
 * incomplete-section flags, and the per-room existing emitters (the "Emitter
 * performance" tables) parsed from the detailed room sections.
 */

import type { SurveyedEmitter } from "@/contracts/survey";

const num = (s: string) => Number(s.replace(/,/g, ""));

/**
 * Existing emitters per room, parsed from the detailed "HEAT LOSS BY ROOM"
 * sections (one per room, in the same order as the summary table).
 *
 * Each room section may carry an "Emitter performance" block; beneath its
 * `EMITTER … OUTPUT … % DEMAND MET` header the surveyed radiators are listed as
 * repeating 4-line groups:
 *
 *   Radiator
 *   Type 21 (P+)
 *   600 x 1200 mm
 *   511 W58 %
 *
 * These are the *existing* radiators (status "keep"); the proposed New/Replace
 * design is engine output, not survey input. UFH rooms have no such block.
 * Returns one entry per room section, in document order, for zipping onto the
 * summary rooms by index (the two orderings are identical in the real report).
 */
export function extractRoomEmitters(text: string): SurveyedEmitter[][] {
  const sections = text.split(/^HEAT LOSS BY ROOM$/m).slice(1);
  const emitterRow = /^(\d[\d,]*)\s*W\s*\d+\s*%$/; // "511 W58 %" → output W
  const typeRow = /^(Type\s+\d+\s*\([^)]+\))$/; // "Type 21 (P+)"
  const dimsRow = /^(\d+)\s*x\s*(\d+)\s*mm$/; // "600 x 1200 mm"

  return sections.map((section) => {
    const lines = section.split("\n").map((l) => l.trim());
    const headerIdx = lines.findIndex((l) => /EMITTER.*OUTPUT.*DEMAND MET/.test(l));
    if (headerIdx < 0) return [];

    const emitters: SurveyedEmitter[] = [];
    let i = headerIdx + 1;
    while (i < lines.length && lines[i] === "Radiator") {
      const type = lines[i + 1]?.match(typeRow);
      const dims = lines[i + 2]?.match(dimsRow);
      const out = lines[i + 3]?.match(emitterRow);
      if (!type || !dims || !out) break; // end of the emitter table
      emitters.push({
        type: "radiator",
        status: "keep",
        description: `${type[1]} ${dims[1]}x${dims[2]} mm`,
        outputW: num(out[1]),
      });
      i += 4;
    }
    return emitters;
  });
}

/** Parse the already-extracted report text into a SurveyObject. */
export function parseSprucePdfText(text: string): SurveyObject {
  // --- Property ---
  const addr = text.match(/Prepared for\n([^\n]+)\n([^\n]+)\n([^\n]+)\nPrepared by/);
  const address = addr ? `${addr[2].trim()}, ${addr[3].trim()}` : "Unknown";

  // --- Design conditions ---
  const outdoor = text.match(/Design outdoor air temperature[\s\S]*?\n(-?\d+(?:\.\d+)?)\s*°C/);
  const externalDesignTempC = outdoor ? Number(outdoor[1]) : NaN;

  // --- Whole house ---
  const totalKw = text.match(/Total heat loss\n([\d.]+)\s*kW/);
  const wholeHouseW = totalKw ? Math.round(Number(totalKw[1]) * 1000) : NaN;
  const floorArea = text.match(/Floor area\n(\d+(?:\.\d+)?)\s*m²/);

  // --- Heat pump (from the summary) ---
  const hp = text.match(/(Vaillant|Grant)\s+([A-Za-z0-9 ]*?(\d+(?:\.\d+)?)\s*kW)/);

  // --- Floor subtotals (used to assign rooms to floors) ---
  const groundTotal = text.match(/Ground floor\nHeat loss by room\s*([\d,]+)\s*W/);
  const firstTotal = text.match(/First floor\nHeat loss by room\s*([\d,]+)\s*W/);

  // --- Room-by-room summary table ---
  const tableStart = text.indexOf("PER UNIT AREA");
  const tableEnd = text.indexOf("*ACH", tableStart);
  const block = tableStart >= 0 && tableEnd >= 0 ? text.slice(tableStart, tableEnd) : "";
  const rowRe = /^(.+?)(\d{2})\s*°C(\d\.\d)([\d.]+)\s*m²([\d,]+)\s*m³([\d,]+)\s*W(\d+)\s*W\/m²$/;

  type ParsedRoom = { name: string; roomTempC: number; heatLossW: number; floorAreaM2: number };
  const parsedRooms: ParsedRoom[] = [];
  for (const line of block.split("\n")) {
    const m = line.trim().match(rowRe);
    if (!m) continue;
    parsedRooms.push({
      name: m[1].trim(),
      roomTempC: Number(m[2]),
      floorAreaM2: Number(m[4]),
      heatLossW: num(m[6]),
    });
  }

  // Assign floors using the ground-floor subtotal: the summary lists ground
  // rooms first, then first-floor rooms, so the cumulative loss hits the ground
  // total exactly at the boundary (this also disambiguates the two Hall/Landing).
  const flags: SurveyObject["flags"] = [];
  let boundary = parsedRooms.length;
  if (groundTotal) {
    const target = num(groundTotal[1]);
    let cum = 0;
    let found = false;
    for (let i = 0; i < parsedRooms.length; i++) {
      cum += parsedRooms[i].heatLossW;
      if (cum === target) {
        boundary = i + 1;
        found = true;
        break;
      }
    }
    if (!found) {
      flags.push({
        code: "floor_assignment_uncertain",
        message: "Could not reconcile room losses to the ground-floor subtotal; floors are a best guess.",
        severity: "warning",
      });
    }
  }

  // Existing emitters from the detailed room sections, in document order — the
  // same order as the summary table, so they zip onto the rooms by index. Guard
  // against a mismatch (e.g. a layout change) by only attaching when names line
  // up; flag if the counts diverge so it's never silently wrong.
  const emittersBySection = extractRoomEmitters(text);
  if (emittersBySection.length !== parsedRooms.length && emittersBySection.length > 0) {
    flags.push({
      code: "emitter_section_mismatch",
      message: `Found ${emittersBySection.length} room emitter sections but ${parsedRooms.length} summary rooms; emitters not attached.`,
      severity: "warning",
    });
  }
  const canZip = emittersBySection.length === parsedRooms.length;

  const rooms = parsedRooms.map((r, i) => ({
    name: r.name,
    floor: i < boundary ? "ground" : "first",
    roomTempC: r.roomTempC,
    heatLossW: r.heatLossW,
    floorAreaM2: r.floorAreaM2,
    ...(canZip && emittersBySection[i].length > 0
      ? { emitters: emittersBySection[i] }
      : {}),
  }));

  // --- Incomplete sections → flags (never assume done) ---
  if (/Sound assessment[\s\S]{0,800}?Incomplete/.test(text)) {
    flags.push({
      code: "sound_assessment_incomplete",
      message: "MCS 020a sound assessment is Incomplete — must be completed before sign-off.",
      severity: "warning",
    });
  }

  const raw = {
    version: SURVEY_OBJECT_VERSION,
    source: "pdf" as const,
    property: { address },
    designConditions: {
      externalDesignTempC,
      // Whole-house default; per-room set points are authoritative (roomTempC).
      internalDesignTempC: 21,
    },
    wholeHouse: {
      heatLossW: wholeHouseW,
      ...(floorArea ? { floorAreaM2: Number(floorArea[1]) } : {}),
    },
    rooms,
    ...(hp
      ? {
          heatPump: {
            manufacturer: hp[1],
            model: hp[2].trim(),
            ratedCapacityKw: Number(hp[3]),
          },
        }
      : {}),
    flags,
  };

  return parseSurveyObject(raw);
}

/** Extract text from a Spruce report PDF and parse it into a SurveyObject. */
export async function parseSprucePdf(buffer: Buffer | Uint8Array): Promise<SurveyObject> {
  const data = await pdfParse(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  return parseSprucePdfText(data.text);
}
