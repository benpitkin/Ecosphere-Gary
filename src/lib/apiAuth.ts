import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Machine-to-machine API authentication for Gary's inbound endpoints.
 * ==================================================================
 *
 * Gary is a standalone service that EcoSphere's other tools (Core, etc.) call
 * over HTTPS. This guards those calls with a shared secret so only your tools
 * can reach the engine once Gary is exposed.
 *
 * **Env-gated, off by default.** Set `GARY_API_KEY` to enable enforcement; when
 * it's unset, auth is disabled (so local dev, tests, and the internal staff
 * pages keep working). In any deployed/exposed environment, set it.
 *
 * Callers present the key as either:
 *   - `Authorization: Bearer <key>`  (preferred), or
 *   - `x-api-key: <key>`
 *
 * NOTE: when enforcement is on, the internal browser pages (/triage, /design,
 * /solar) — which fetch these routes client-side — won't carry the key. Run
 * those behind platform SSO (e.g. Vercel) for staff access, or keep
 * `GARY_API_KEY` unset in environments where staff use the browser UI. A future
 * change can split staff-session auth from machine auth.
 */

/** Constant-time string comparison (avoids leaking the key via timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Pull the presented key from the Authorization or x-api-key header. */
function presentedKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  const x = request.headers.get("x-api-key");
  return x ? x.trim() : null;
}

/** True when API-key enforcement is switched on (GARY_API_KEY is set). */
export function isApiAuthEnabled(): boolean {
  return Boolean(process.env.GARY_API_KEY?.trim());
}

/**
 * Returns a 401 response when the request fails auth, or `null` when it's
 * allowed (either auth is disabled, or the key matched). Usage in a route:
 *
 *   const denied = requireApiKey(request);
 *   if (denied) return denied;
 */
export function requireApiKey(request: Request): NextResponse | null {
  const expected = process.env.GARY_API_KEY?.trim();
  if (!expected) return null; // enforcement disabled

  const presented = presentedKey(request);
  if (presented && safeEqual(presented, expected)) return null;

  return NextResponse.json(
    {
      error: "unauthorized",
      message: "Missing or invalid API key. Present it as 'Authorization: Bearer <key>' or 'x-api-key: <key>'.",
    },
    { status: 401 },
  );
}
