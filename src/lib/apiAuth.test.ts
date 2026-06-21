import { describe, it, expect, afterEach } from "vitest";
import { requireApiKey, isApiAuthEnabled } from "@/lib/apiAuth";

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { method: "POST", headers });

const KEY = "test-secret-key";

afterEach(() => {
  delete process.env.GARY_API_KEY;
});

describe("API-key auth", () => {
  it("is disabled (allows everything) when GARY_API_KEY is unset", () => {
    expect(isApiAuthEnabled()).toBe(false);
    expect(requireApiKey(req())).toBeNull();
  });

  it("allows a correct Bearer token when enabled", () => {
    process.env.GARY_API_KEY = KEY;
    expect(isApiAuthEnabled()).toBe(true);
    expect(requireApiKey(req({ authorization: `Bearer ${KEY}` }))).toBeNull();
  });

  it("allows a correct x-api-key header when enabled", () => {
    process.env.GARY_API_KEY = KEY;
    expect(requireApiKey(req({ "x-api-key": KEY }))).toBeNull();
  });

  it("rejects a missing key with 401 when enabled", () => {
    process.env.GARY_API_KEY = KEY;
    const res = requireApiKey(req());
    expect(res?.status).toBe(401);
  });

  it("rejects a wrong key with 401 when enabled", () => {
    process.env.GARY_API_KEY = KEY;
    expect(requireApiKey(req({ authorization: "Bearer nope" }))?.status).toBe(401);
    expect(requireApiKey(req({ "x-api-key": "nope" }))?.status).toBe(401);
  });

  it("rejects a key of a different length without throwing", () => {
    process.env.GARY_API_KEY = KEY;
    // Different length must not crash timingSafeEqual — it returns 401.
    expect(requireApiKey(req({ "x-api-key": "short" }))?.status).toBe(401);
  });
});
