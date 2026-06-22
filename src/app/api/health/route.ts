import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/gary/lib/supabase";
import { isCoreConfigured } from "@/gary/lib/core";
import { isSolarReasoningConfigured } from "@/gary/lib/solar";
import { isOpenSolarConfigured } from "@/gary/lib/integrations/opensolar";
import { isEpcConfigured } from "@/gary/lib/triage/epc";
import { isApiAuthEnabled } from "@/gary/lib/apiAuth";
import { OPTION_COUNT, FLOW_TEMPS_C } from "@/gary/config/decisions";

export const dynamic = "force-dynamic";

/** Lightweight readiness probe — also reports which integrations are wired. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    options: OPTION_COUNT,
    flowTempsC: FLOW_TEMPS_C,
    /** Whether the inbound API requires a key (GARY_API_KEY set). */
    apiAuthEnabled: isApiAuthEnabled(),
    integrations: {
      supabase: isSupabaseConfigured(),
      core: isCoreConfigured(),
      anthropic: isSolarReasoningConfigured(),
      openSolar: isOpenSolarConfigured(),
      epc: isEpcConfigured(),
    },
  });
}
