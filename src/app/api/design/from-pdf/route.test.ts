import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { POST } from "@/app/api/design/from-pdf/route";

const pdfBytes = () =>
  new Uint8Array(readFileSync(resolve(__dirname, "../../../../../fixtures/3-orchard-close.pdf")));

const postWith = (body: BodyInit | null) =>
  POST(new Request("http://localhost/api/design/from-pdf", { method: "POST", body }));

describe("POST /api/design/from-pdf", () => {
  it("parses a Spruce PDF and returns the three design options", async () => {
    const form = new FormData();
    form.set("file", new File([pdfBytes()], "3-orchard-close.pdf", { type: "application/pdf" }));

    const res = await postWith(form);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.survey.rooms).toHaveLength(13);
    expect(body.result.options.map((o: { key: string }) => o.key)).toEqual([
      "eco",
      "sweet_spot",
      "budget",
    ]);
    expect(body.result.recommended).toBe("sweet_spot");
    // The MCS031 provisional blocker must be surfaced; the Stelrad catalogue is
    // now the engine default, so that blocker should NOT appear.
    const blockers = body.result.reviewFlags
      .filter((f: { severity: string }) => f.severity === "blocker")
      .map((f: { code: string }) => f.code);
    expect(blockers).toContain("mcs031_provisional");
    expect(blockers).not.toContain("stelrad_catalogue_pending");
  });

  it("rejects a request with no file", async () => {
    const res = await postWith(new FormData());
    expect(res.status).toBe(400);
  });

  describe("with API-key enforcement enabled", () => {
    afterEach(() => {
      delete process.env.GARY_API_KEY;
    });

    it("returns 401 when the key is missing", async () => {
      process.env.GARY_API_KEY = "secret";
      const form = new FormData();
      form.set("file", new File([pdfBytes()], "x.pdf", { type: "application/pdf" }));
      const res = await postWith(form);
      expect(res.status).toBe(401);
    });

    it("allows the request with the correct key", async () => {
      process.env.GARY_API_KEY = "secret";
      const form = new FormData();
      form.set("file", new File([pdfBytes()], "x.pdf", { type: "application/pdf" }));
      const res = await POST(
        new Request("http://localhost/api/design/from-pdf", {
          method: "POST",
          body: form,
          headers: { authorization: "Bearer secret" },
        }),
      );
      expect(res.status).toBe(200);
    });
  });
});
