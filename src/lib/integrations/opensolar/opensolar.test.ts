import { describe, it, expect, vi } from "vitest";
import {
  createOpenSolarClient,
  openSolarConfigFromEnv,
  isOpenSolarConfigured,
  OpenSolarNotConfiguredError,
  OpenSolarPendingError,
  OpenSolarApiError,
  type OpenSolarConfig,
} from "@/lib/integrations/opensolar";

const config: OpenSolarConfig = {
  token: "test-token",
  orgId: "42",
  baseUrl: "https://api.opensolar.com",
};

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  }) as Response;

/** A fetch mock whose recorded calls carry fetch's parameter types. */
const mockFetch = (impl: () => Response) =>
  vi.fn((..._args: Parameters<typeof fetch>): Promise<Response> => Promise.resolve(impl()));

describe("OpenSolar config gate", () => {
  it("reads token + org from the environment, defaulting the base URL", () => {
    const env = process.env;
    process.env = { ...env, OPENSOLAR_API_TOKEN: "t", OPENSOLAR_ORG_ID: "9" };
    expect(isOpenSolarConfigured()).toBe(true);
    expect(openSolarConfigFromEnv()).toEqual({
      token: "t",
      orgId: "9",
      baseUrl: "https://api.opensolar.com",
    });
    process.env = env;
  });

  it("is unconfigured (null) when env vars are absent", () => {
    const env = process.env;
    process.env = { ...env };
    delete process.env.OPENSOLAR_API_TOKEN;
    delete process.env.OPENSOLAR_ORG_ID;
    expect(isOpenSolarConfigured()).toBe(false);
    expect(openSolarConfigFromEnv()).toBeNull();
    process.env = env;
  });

  it("throws when building a client without config", () => {
    expect(() => createOpenSolarClient({ config: undefined, fetchImpl: vi.fn() })).toThrow(
      OpenSolarNotConfiguredError,
    );
  });
});

describe("OpenSolar reads (confirmed endpoints)", () => {
  it("gets a system with bearer auth and parses the headline fields", async () => {
    const fetchImpl = mockFetch(() =>
      jsonResponse({ id: 7, kw_stc: 4.2, module_quantity: 10, output_annual_kwh: 4100, extra: "kept" }),
    );
    const client = createOpenSolarClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch });

    const system = await client.getSystem(7);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.opensolar.com/api/orgs/42/systems/7/?fieldset=list");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token" });
    expect(system.kw_stc).toBe(4.2);
    // passthrough keeps undocumented fields.
    expect((system as Record<string, unknown>).extra).toBe("kept");
  });

  it("lists systems for a project, handling a paginated envelope", async () => {
    const fetchImpl = mockFetch(() => jsonResponse({ results: [{ id: 1 }, { id: 2 }] }));
    const client = createOpenSolarClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch });

    const systems = await client.listSystems(99);

    expect(systems.map((s) => s.id)).toEqual([1, 2]);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://api.opensolar.com/api/orgs/42/systems/?fieldset=list&project=99",
    );
  });

  it("surfaces a non-OK response as an OpenSolarApiError", async () => {
    const fetchImpl = mockFetch(() => jsonResponse({}, false, 403));
    const client = createOpenSolarClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.getSystem(1)).rejects.toBeInstanceOf(OpenSolarApiError);
  });
});

describe("OpenSolar writes (pending confirmation)", () => {
  const client = createOpenSolarClient({ config, fetchImpl: vi.fn() as unknown as typeof fetch });

  it("stubs project creation until the payload is confirmed", async () => {
    await expect(client.createProjectFromInput({ address: "1 Test St" })).rejects.toBeInstanceOf(
      OpenSolarPendingError,
    );
  });

  it("stubs auto-design until the trigger mechanism is confirmed", async () => {
    await expect(client.requestAutoDesign(1)).rejects.toBeInstanceOf(OpenSolarPendingError);
  });
});
