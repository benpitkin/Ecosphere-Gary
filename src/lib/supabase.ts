import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client factory.
 *
 * Phase 0: env vars are expected to be empty until Gary's own Supabase project
 * is provisioned. We therefore construct clients lazily so that importing this
 * module (e.g. during `next build`) never throws on missing configuration.
 */

let browserClient: SupabaseClient | null = null;

/** Returns true once Supabase env vars are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Client-safe Supabase client (anon key). Throws if not yet configured. */
export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (provisioned in a later phase).",
    );
  }
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
  }
  return browserClient;
}
