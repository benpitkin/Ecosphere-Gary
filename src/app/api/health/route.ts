import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isCoreConfigured } from "@/lib/core";
import { OPTION_COUNT, FLOW_TEMPS_C } from "@/config/decisions";

export const dynamic = "force-dynamic";

/** Lightweight readiness probe — also reports which integrations are wired. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    phase: 0,
    options: OPTION_COUNT,
    flowTempsC: FLOW_TEMPS_C,
    integrations: {
      supabase: isSupabaseConfigured(),
      core: isCoreConfigured(),
    },
  });
}
