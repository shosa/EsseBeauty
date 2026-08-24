import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { consentNetworkOnly, consentRouteHeaders, publicTokenRouteHeaders } from "./lib/cache-policy.mjs";
import nextConfig from "./next.config.mjs";
import {
  buildPublicConsentPath,
  buildTypedSignaturePayload,
  initialPublicSigningState,
  loadPublicConsentView,
  publicSigningReducer,
  publicConsentErrorMessage,
} from "./app/consents/consent-signing.js";

describe("public consent signing", () => {
  it("exposes an Italian, encoding-safe acceptance page", () => {
    const publicPath = join(process.cwd(), "app/consents/[token]/page.tsx");
    expect(existsSync(publicPath)).toBe(true);
    const publicSource = readFileSync(publicPath, "utf8");
    expect(publicSource).toContain("Accetto il documento");
    expect(publicSource).not.toMatch(/[ÃÂ�]/);
  });

  it("keeps the bearer token in the encoded request path", () => {
    const token = "v1.consent/secret?not-a-query";
    const path = buildPublicConsentPath("https://api.example.test", token, "sign");
    expect(path).toBe(
      "https://api.example.test/api/public/consents/v1.consent%2Fsecret%3Fnot-a-query/sign",
    );
    expect(new URL(path).search).toBe("");
  });

  it("keeps token-bearing routes out of the service-worker cache", () => {
    expect(consentNetworkOnly.handler).toBe("NetworkOnly");
    expect(consentNetworkOnly.method).toBe("GET");
    expect(consentNetworkOnly.urlPattern.test("https://pwa.example.test/consents/v1.secret")).toBe(true);
    expect(consentNetworkOnly.urlPattern.test("https://api.example.test/api/public/consents/v1.secret")).toBe(true);
    expect(consentNetworkOnly.urlPattern.test("https://pwa.example.test/salon/book")).toBe(false);
  });

  it("sets a route-level no-referrer policy for every public consent token path", async () => {
    expect(consentRouteHeaders).toEqual([{
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      source: "/consents/:token",
    }]);
    expect(await nextConfig.headers?.()).toEqual(publicTokenRouteHeaders);
  });

  it("puts the signature only in the JSON body", () => {
    expect(buildTypedSignaturePayload("  Mario Rossi  ")).toEqual({
      accepted: true,
      signature: { type: "typed", value: "Mario Rossi" },
      signer_name: "Mario Rossi",
    });
  });

  it("explains stable token lifecycle errors without exposing details", () => {
    expect(publicConsentErrorMessage("TOKEN_EXPIRED")).toBe("Questo link è scaduto. Chiedi al salone un nuovo invito.");
    expect(publicConsentErrorMessage("TOKEN_CONSUMED")).toBe("Questo documento è già stato firmato.");
    expect(publicConsentErrorMessage("TOKEN_REVOKED")).toBe("Questo consenso è stato revocato.");
    expect(publicConsentErrorMessage("TOKEN_INVALID")).toBe("Il link non è valido o non è più disponibile.");
    expect(publicConsentErrorMessage(undefined)).toBe("Non è stato possibile caricare il documento.");
  });

  it("preserves the signer form when a signing attempt fails", () => {
    let state = initialPublicSigningState;
    state = publicSigningReducer(state, { field: "signerName", type: "change", value: "Mario Rossi" });
    state = publicSigningReducer(state, { field: "accepted", type: "change", value: true });
    state = publicSigningReducer(state, { type: "submit" });
    state = publicSigningReducer(state, { error: "Firma non registrata.", type: "failure" });

    expect(state).toMatchObject({
      accepted: true,
      error: "Firma non registrata.",
      signed: false,
      signerName: "Mario Rossi",
      submitting: false,
    });
  });

  it("returns explicit public document success and error load states", async () => {
    const view = {
      consent: { body: "Testo canonico", expires_at: null, id: "consent-1", name: "Privacy", status: "pending" as const, type: "privacy", version: 3 },
      salon: { name: "Esse Beauty" },
    };
    const success = await loadPublicConsentView(
      async () => new Response(JSON.stringify(view), { status: 200 }),
      "https://api.example.test/api/public/consents/token",
    );
    const failure = await loadPublicConsentView(
      async () => new Response(JSON.stringify({ error: "TOKEN_EXPIRED" }), { status: 410 }),
      "https://api.example.test/api/public/consents/token",
    );

    expect(success).toEqual({ documentView: view, ok: true });
    expect(failure).toEqual({ error: "Questo link è scaduto. Chiedi al salone un nuovo invito.", ok: false });
  });
});
