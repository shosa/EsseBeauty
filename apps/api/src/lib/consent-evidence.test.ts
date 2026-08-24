import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

import { customerConsents } from "@esse-beauty/db/schema";

import { issuePublicToken } from "./public-tokens.js";

import type {
  ConsentLifecycleRepository,
  ConsentLifecycleTransaction,
  ConsentRequestRecord,
  ConsentRequestWithDocument,
  ConsentTemplateRecord,
} from "./consent-evidence.js";
import {
  createConsentRequest,
  createConsentTemplate,
  renderConsentEvidence,
  resolveConsent,
  revokeConsent,
  signConsent,
  versionTemplate,
} from "./consent-evidence.js";

const now = new Date("2026-08-24T10:00:00.000Z");

function template(overrides: Partial<ConsentTemplateRecord> = {}): ConsentTemplateRecord {
  return {
    active: true,
    body: "Testo firmato originale",
    createdAt: now,
    id: "template-1",
    name: "Consenso viso",
    requiredForServices: ["service-1"],
    salonId: "salon-1",
    type: "treatment",
    updatedAt: now,
    version: 1,
    ...overrides,
  };
}

function consent(
  source: ConsentTemplateRecord,
  overrides: Partial<ConsentRequestRecord> = {},
): ConsentRequestWithDocument {
  return {
    appointmentId: "appointment-1",
    createdAt: now,
    customerId: "customer-1",
    deliveryChannel: "email",
    documentHash: null,
    expiresAt: new Date("2026-08-25T10:00:00.000Z"),
    id: "consent-1",
    ipAddress: null,
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
    salonId: source.salonId,
    salonName: "Esse Beauty",
    signatureData: {},
    signedAt: null,
    signerName: null,
    status: "pending",
    templateBody: source.body,
    templateId: source.id,
    templateName: source.name,
    templateType: source.type,
    templateVersion: source.version,
    tokenHash: null,
    userAgent: null,
    ...overrides,
  };
}

function memoryRepository(seed?: {
  consents?: ConsentRequestWithDocument[];
  templates?: ConsentTemplateRecord[];
}) {
  const templates = [...(seed?.templates ?? [template()])];
  const consents = [...(seed?.consents ?? [])];

  const transactionCalls = vi.fn();
  async function transaction<T>(work: (tx: ConsentLifecycleTransaction) => Promise<T>): Promise<T> {
    transactionCalls();
    const tx: ConsentLifecycleTransaction = {
      appointmentBelongsToSalon: async ({ appointmentId, customerId, salonId }) =>
        appointmentId === "appointment-1" && customerId === "customer-1" && salonId === "salon-1",
      archiveTemplate: async (salonId, templateId) => {
        const current = templates.find((item) => item.id === templateId && item.salonId === salonId);
        if (!current) return undefined;
        current.active = false;
        return current;
      },
      customerBelongsToSalon: async (salonId, customerId) =>
        salonId === "salon-1" && customerId === "customer-1",
      expireDueConsents: async (salonId) => {
        let expired = 0;
        for (const item of consents) {
          if (
            item.salonId === salonId &&
            item.status === "pending" &&
            item.expiresAt &&
            item.expiresAt.getTime() <= Date.now()
          ) {
            item.status = "expired";
            expired += 1;
          }
        }
        return expired;
      },
      findConsentById: async (salonId, consentId) =>
        consents.find((item) => item.id === consentId && item.salonId === salonId),
      findConsentByTokenHash: async (tokenHash) =>
        consents.find((item) => item.tokenHash === tokenHash),
      findTemplate: async (salonId, templateId) =>
        templates.find((item) => item.id === templateId && item.salonId === salonId),
      insertConsent: async (input) => {
        const source = templates.find((item) => item.id === input.templateId)!;
        const created = consent(source, input);
        consents.push(created);
        return created;
      },
      insertTemplate: async (input) => {
        const created = template({ id: `template-${templates.length + 1}`, ...input });
        templates.push(created);
        return created;
      },
      latestTemplateVersion: async (salonId, name) =>
        Math.max(...templates.filter((item) => item.salonId === salonId && item.name === name).map((item) => item.version)),
      lockTemplateName: async () => undefined,
      servicesBelongToSalon: async (salonId, serviceIds) =>
        salonId === "salon-1" && serviceIds.every((id) => id === "service-1"),
      updateConsent: async (salonId, consentId, changes) => {
        const current = consents.find((item) => item.id === consentId && item.salonId === salonId);
        if (!current) return undefined;
        Object.assign(current, changes);
        return current;
      },
      userBelongsToSalon: async (salonId, userId) =>
        salonId === "salon-1" && userId === "owner-1",
    };
    return work(tx);
  }

  return {
    consents,
    repository: { transaction } satisfies ConsentLifecycleRepository,
    templates,
    transaction: transactionCalls,
  };
}

describe("consent lifecycle", () => {
  it("declares token and document hash constraints in the Drizzle schema", () => {
    const checks = getTableConfig(customerConsents).checks.map((constraint) => constraint.name);

    expect(checks).toContain("customer_consents_token_hash_format");
    expect(checks).toContain("customer_consents_document_hash_format");
  });

  it("maps a residual unique conflict to a stable lifecycle error", async () => {
    const repository: ConsentLifecycleRepository = {
      async transaction() {
        throw Object.assign(new Error("duplicate template version"), { code: "23505" });
      },
    };

    await expect(createConsentTemplate(repository, {
      body: "Testo",
      name: "Consenso concorrente",
      salonId: "salon-1",
      type: "treatment",
    })).rejects.toMatchObject({
      code: "CONSENT_TEMPLATE_VERSION_CONFLICT",
      statusCode: 409,
    });
  });

  it("creates a new version instead of editing a signed template", async () => {
    const usedTemplate = template();
    const memory = memoryRepository({
      consents: [consent(usedTemplate, { signedAt: now, status: "signed" })],
      templates: [usedTemplate],
    });

    const next = await versionTemplate(memory.repository, usedTemplate.id, {
      body: "Nuovo testo",
      salonId: "salon-1",
    });

    expect(next.version).toBe(usedTemplate.version + 1);
    expect(memory.templates.find((item) => item.id === usedTemplate.id)?.body).toBe(
      "Testo firmato originale",
    );
  });

  it("creates a tenant-scoped request without persisting the raw token", async () => {
    const memory = memoryRepository();

    const created = await createConsentRequest(memory.repository, {
      appointmentId: "appointment-1",
      customerId: "customer-1",
      deliveryChannel: "email",
      expiresAt: new Date(Date.now() + 60_000),
      salonId: "salon-1",
      templateId: "template-1",
    });

    expect(created.rawToken).not.toBe(created.consent.tokenHash);
    expect(created.consent.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(memory.consents)).not.toContain(created.rawToken);
    expect(memory.transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects an appointment that does not belong to the customer and salon", async () => {
    const memory = memoryRepository();

    await expect(createConsentRequest(memory.repository, {
      appointmentId: "appointment-outside-salon",
      customerId: "customer-1",
      deliveryChannel: "in_person",
      expiresAt: new Date(Date.now() + 60_000),
      salonId: "salon-1",
      templateId: "template-1",
    })).rejects.toThrow("CONSENT_APPOINTMENT_INVALID");
    expect(memory.consents).toHaveLength(0);
  });

  it("rejects a legacy template that references another salon's service", async () => {
    const unsafeTemplate = template({ requiredForServices: ["service-other-salon"] });
    const memory = memoryRepository({ templates: [unsafeTemplate] });

    await expect(createConsentRequest(memory.repository, {
      customerId: "customer-1",
      deliveryChannel: "in_person",
      expiresAt: new Date(Date.now() + 60_000),
      salonId: "salon-1",
      templateId: unsafeTemplate.id,
    })).rejects.toThrow("CONSENT_SERVICE_INVALID");
    expect(memory.consents).toHaveLength(0);
  });

  it("signs once and persists the exact document hash", async () => {
    const memory = memoryRepository();
    const created = await createConsentRequest(memory.repository, {
      appointmentId: "appointment-1",
      customerId: "customer-1",
      deliveryChannel: "email",
      expiresAt: new Date(Date.now() + 60_000),
      salonId: "salon-1",
      templateId: "template-1",
    });
    const input = {
      accepted: true as const,
      signature: { type: "typed" as const, value: "Mario Rossi" },
      signerName: "Mario Rossi",
    };

    const signed = await signConsent(memory.repository, created.rawToken, input);

    expect(signed.documentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(memory.consents[0]?.documentHash).toBe(signed.documentHash);
    await expect(signConsent(memory.repository, created.rawToken, input)).rejects.toThrow(
      "TOKEN_CONSUMED",
    );
  });

  it("persists expired status and returns TOKEN_EXPIRED from resolve and sign", async () => {
    const source = template();
    const expired = issuePublicToken(
      "consent",
      "consent-expired",
      new Date(Date.now() - 60_000),
    );
    const memory = memoryRepository({
      consents: [consent(source, {
        expiresAt: expired.expiresAt,
        id: "consent-expired",
        tokenHash: expired.tokenHash,
      })],
      templates: [source],
    });
    const signature = {
      accepted: true as const,
      signature: { type: "typed" as const, value: "Mario Rossi" },
      signerName: "Mario Rossi",
    };

    await expect(resolveConsent(memory.repository, expired.raw)).rejects.toThrow("TOKEN_EXPIRED");
    expect(memory.consents[0]?.status).toBe("expired");
    await expect(signConsent(memory.repository, expired.raw, signature)).rejects.toThrow("TOKEN_EXPIRED");
    expect(memory.consents[0]?.status).toBe("expired");
  });

  it("exports every canonical hash field and rejects a modified snapshot", async () => {
    const memory = memoryRepository();
    const created = await createConsentRequest(memory.repository, {
      customerId: "customer-1",
      deliveryChannel: "in_person",
      expiresAt: new Date(Date.now() + 60_000),
      salonId: "salon-1",
      templateId: "template-1",
    });
    await signConsent(memory.repository, created.rawToken, {
      accepted: true,
      signature: { type: "typed", value: "Mario Rossi" },
      signerName: "Mario Rossi",
    });

    const evidence = await renderConsentEvidence(memory.repository, created.consent.id, {
      salonId: "salon-1",
    });
    const canonicalLine = evidence.content
      .split("\n")
      .find((line) => line.startsWith("Input SHA-256: "));
    const canonical = canonicalLine?.slice("Input SHA-256: ".length);
    expect(evidence.content).toContain("Template ID: template-1");
    expect(evidence.content).toContain("Tipo: treatment");
    expect(canonical).toBeTruthy();
    expect(createHash("sha256").update(canonical!).digest("hex")).toBe(evidence.documentHash);

    const storedDocument = memory.consents[0]?.signatureData.document as Record<string, unknown>;
    storedDocument.body = "Testo alterato dopo la firma";
    await expect(renderConsentEvidence(memory.repository, created.consent.id, {
      salonId: "salon-1",
    })).rejects.toThrow("CONSENT_EVIDENCE_TAMPERED");

    memory.consents[0]!.signatureData.document = null;
    await expect(renderConsentEvidence(memory.repository, created.consent.id, {
      salonId: "salon-1",
    })).rejects.toThrow("CONSENT_EVIDENCE_TAMPERED");
  });

  it("revokes without deleting the original evidence", async () => {
    const source = template();
    const signed = consent(source, {
      documentHash: "cb9991d1ee29cc19b8b2ac6b8738de75a406621aadec37e5e74a252353a4d9c7",
      signatureData: {
        accepted: true,
        document: {
          body: source.body,
          name: source.name,
          templateId: source.id,
          type: source.type,
          version: source.version,
        },
        signature: { type: "typed", value: "Mario Rossi" },
      },
      signedAt: now,
      signerName: "Mario Rossi",
      status: "signed",
    });
    const memory = memoryRepository({ consents: [signed], templates: [source] });

    const revoked = await revokeConsent(memory.repository, signed.id, {
      reason: "Consenso ritirato dal cliente",
      revokedByUserId: "owner-1",
      salonId: "salon-1",
    });
    const evidence = await renderConsentEvidence(memory.repository, signed.id, {
      salonId: "salon-1",
    });

    expect(revoked.status).toBe("revoked");
    expect(revoked.documentHash).toBe(
      "cb9991d1ee29cc19b8b2ac6b8738de75a406621aadec37e5e74a252353a4d9c7",
    );
    expect(evidence.content).toContain("Testo firmato originale");
    expect(evidence.content).toContain("Consenso ritirato dal cliente");
  });
});
