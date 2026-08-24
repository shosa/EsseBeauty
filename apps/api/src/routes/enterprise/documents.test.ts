import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DrizzleDB } from "@esse-beauty/db";

import type { ConsentLifecycleRepository } from "../../lib/consent-evidence.js";
import {
  createConsentRequestBodySchema,
  registerEnterpriseModuleRoutes,
} from "./index.js";

const apps: Array<ReturnType<typeof Fastify>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("document route contracts", () => {
  it("rejects malformed consent assignments before opening a transaction", () => {
    const parsed = createConsentRequestBodySchema.safeParse({
      customer_id: "not-a-uuid",
      delivery_channel: "carrier-pigeon",
      expires_at: "yesterday",
      template_id: "also-not-a-uuid",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) throw new Error("Expected validation failure");
    expect(parsed.error.fieldErrors).toMatchObject({
      customer_id: ["Cliente non valido"],
      delivery_channel: ["Canale di consegna non valido"],
      expires_at: ["Scadenza non valida"],
      template_id: ["Modello non valido"],
    });
  });

  it("rejects public signing without explicit acceptance before touching storage", async () => {
    const transaction = vi.fn();
    const app = Fastify();
    app.decorate("db", {} as DrizzleDB);
    app.decorateRequest("salonId", "");
    app.decorateRequest("user");
    await registerEnterpriseModuleRoutes(app, {
      consentRepository: { transaction } as ConsentLifecycleRepository,
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      payload: {
        accepted: false,
        signature: { type: "typed", value: "Mario Rossi" },
        signer_name: "Mario Rossi",
      },
      url: "/api/public/consents/not-a-token/sign",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "INVALID_REQUEST",
      fields: { accepted: ["Accettazione esplicita obbligatoria"] },
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
