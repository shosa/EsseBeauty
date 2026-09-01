import { afterEach, describe, expect, it, vi } from "vitest";

import { platformRequest } from "../platform/app/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("platformRequest", () => {
  it("does not declare JSON when a DELETE request has no body", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ deleted: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", request);

    await platformRequest("/api/platform/salons/salon-1?confirmation=test", { method: "DELETE" });

    expect(request).toHaveBeenCalledWith("/api/platform/salons/salon-1?confirmation=test", {
      credentials: "include",
      method: "DELETE",
    });
  });

  it("declares JSON when the request includes a JSON body", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", request);

    await platformRequest("/api/platform/salons/salon-1", { body: JSON.stringify({ name: "Esse" }), method: "PATCH" });

    expect(request).toHaveBeenCalledWith("/api/platform/salons/salon-1", {
      body: JSON.stringify({ name: "Esse" }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
  });
});
