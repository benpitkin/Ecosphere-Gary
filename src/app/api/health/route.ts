import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isCoreConfigured } from "@/lib/core";
import { isSolarReasoningConfigured } from "@/lib/solar";
import { isOpenSolarConfigured } from "@/lib/integrations/opensolar";
import { isEpcConfigured } from "@/lib/triage/epc";
import { isApiAuthEnabled } from "@/lib/apiAuth";
import { OPTION_COUNT, FLOW_TEMPS_C } from "@/config/decisions";

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
