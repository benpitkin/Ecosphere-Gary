import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { isCoreConfigured } from "@/lib/corePrices";
import { OPTION_COUNT } from "@/config/decisions";

export const dynamic = "force-dynamic";

/** Lightweight readiness probe — also reports which integrations are wired. */
export function GET() {
  return NextResponse.json({
    status: "ok",
    phase: 0,
    options: OPTION_COUNT,
    integrations: {
      supabase: isSupabaseConfigured(),
      core: isCoreConfigured(),
    },
  });
}
