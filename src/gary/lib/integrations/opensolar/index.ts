import { z } from "zod";

/**
 * OpenSolar integration adapter.
 * ==============================
 *
 * Lets Gary set up solar (PV) projects in OpenSolar and read back the resulting
 * design ("system"), so the initial-design admin doesn't have to be done by hand.
 * OpenSolar's own AI ("Ada") produces the design — Gary feeds the inputs and reads
 * the result, so this is an **integration adapter**, kept fully decoupled from the
 * heat-pump calc engine (same shape as the Spruce adapter and the Core hand-off).
 *
 * Discipline (matches the Spruce Phase 1 client): we implement only what
 * OpenSolar's docs confirm and **do not fabricate undocumented request payloads**.
 *   - Confirmed → implemented: bearer/org auth + the read endpoints
 *     `GET /api/orgs/:org_id/systems/` and `…/systems/:id/`.
 *   - Not yet confirmed → stubbed with a clear error: creating a project (exact
 *     payload undocumented) and triggering Ada's auto-design (may require the
 *     browser Studio SDK rather than REST — open question for OpenSolar support).
 *
 * Config comes from the environment, so nothing runs until Ben provisions access:
 *   OPENSOLAR_API_TOKEN, OPENSOLAR_ORG_ID, (optional) OPENSOLAR_BASE_URL.
 *
 * See docs/opensolar-integration.md for the full feasibility write-up.
 */

const DEFAULT_BASE_URL = "https://api.opensolar.com";

export interface OpenSolarConfig {
  token: string;
  orgId: string;
  baseUrl: string;
}

/** Read config from the environment; null when access isn't provisioned yet. */
export function openSolarConfigFromEnv(): OpenSolarConfig | null {
  const token = process.env.OPENSOLAR_API_TOKEN?.trim();
  const orgId = process.env.OPENSOLAR_ORG_ID?.trim();
  if (!token || !orgId) return null;
  return {
    token,
    orgId,
    // Strip any trailing slash so path joins don't produce a double slash.
    baseUrl: (process.env.OPENSOLAR_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

export function isOpenSolarConfigured(): boolean {
  return openSolarConfigFromEnv() !== null;
}

export class OpenSolarNotConfiguredError extends Error {
  constructor() {
    super(
      "OpenSolar is not configured — set OPENSOLAR_API_TOKEN and OPENSOLAR_ORG_ID.",
    );
    this.name = "OpenSolarNotConfiguredError";
  }
}

/** Raised by capabilities whose OpenSolar contract isn't confirmed yet. */
export class OpenSolarPendingError extends Error {
  constructor(what: string) {
    super(
      `OpenSolar ${what} is not wired yet — pending confirmation from OpenSolar (see docs/opensolar-integration.md).`,
    );
    this.name = "OpenSolarPendingError";
  }
}

export class OpenSolarApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OpenSolarApiError";
  }
}

/**
 * A "system" = a complete solar design. Only the documented headline fields are
 * typed; `passthrough()` keeps everything else OpenSolar returns so we never drop
 * data we haven't modelled yet.
 */
export const OpenSolarSystem = z
  .object({
    id: z.union([z.number(), z.string()]),
    /** System size, kW STC. */
    kw_stc: z.number().optional(),
    module_quantity: z.number().optional(),
    output_annual_kwh: z.number().optional(),
    consumption_offset_percentage: z.number().optional(),
    battery_total_kwh: z.number().optional(),
    co2_tons_lifetime: z.number().optional(),
    price_including_tax: z.number().optional(),
  })
  .passthrough();
export type OpenSolarSystem = z.infer<typeof OpenSolarSystem>;

/** Seed for an OpenSolar project — the data Gary already holds from the survey. */
export interface OpenSolarProjectInput {
  address: string;
  contactName?: string;
  /** Estimated annual electricity use, kWh, where known. */
  annualConsumptionKwh?: number;
}

export interface OpenSolarClientDeps {
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to env config. */
  config?: OpenSolarConfig;
}

export interface OpenSolarClient {
  /** List systems, optionally for one project. */
  listSystems(projectId?: number | string): Promise<OpenSolarSystem[]>;
  /** Fetch a single system (design) by id. */
  getSystem(id: number | string): Promise<OpenSolarSystem>;
  /** Create a project from Gary's data (REST lead import). Stub — payload TBC. */
  createProjectFromInput(input: OpenSolarProjectInput): Promise<never>;
  /** Trigger Ada's initial auto-design. Stub — REST vs SDK mechanism TBC. */
  requestAutoDesign(projectId: number | string): Promise<never>;
}

export function createOpenSolarClient(
  deps: OpenSolarClientDeps = {},
): OpenSolarClient {
  const config = deps.config ?? openSolarConfigFromEnv();
  if (!config) throw new OpenSolarNotConfiguredError();
  const doFetch = deps.fetchImpl ?? fetch;

  const get = async (path: string, query: Record<string, string> = {}) => {
    const url = new URL(`${config.baseUrl}/api/orgs/${config.orgId}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await doFetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      // Include the server's error body (OpenSolar returns a detail message) so
      // failures are diagnosable, not just a bare status code.
      let detail = "";
      try {
        detail = await res.text();
      } catch {
        /* body unavailable — fall back to the status alone */
      }
      throw new OpenSolarApiError(
        res.status,
        `OpenSolar GET ${path} → ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      );
    }
    return res.json();
  };

  return {
    async listSystems(projectId) {
      const query: Record<string, string> = { fieldset: "list" };
      if (projectId !== undefined) query.project = String(projectId);
      const body = await get("/systems/", query);
      // OpenSolar list endpoints may return an array or a paginated envelope.
      const rows = Array.isArray(body) ? body : (body?.results ?? []);
      return z.array(OpenSolarSystem).parse(rows);
    },

    async getSystem(id) {
      const body = await get(`/systems/${id}/`, { fieldset: "list" });
      return OpenSolarSystem.parse(body);
    },

    async createProjectFromInput(_input) {
      throw new OpenSolarPendingError("project creation (lead import) payload");
    },

    async requestAutoDesign(_projectId) {
      throw new OpenSolarPendingError("auto-design trigger");
    },
  };
}
