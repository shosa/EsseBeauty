import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildConsentFilters,
  buildConsentRequestBody,
  buildSigningHref,
  consentMutationError,
  consentStatusPresentation,
  nextConsentExpiry,
} from "./app/(dashboard)/settings/documents/consent-flow.js";

const dashboardRoot = join(process.cwd(), "app", "(dashboard)");

describe("document lifecycle UI", () => {
  it("exposes template detail, customer consent, and appointment consent routes", () => {
    const documentsSource = readFileSync(join(dashboardRoot, "settings/documents/page.tsx"), "utf8");
    const detailPath = join(dashboardRoot, "settings/documents/[templateId]/page.tsx");
    const customerSource = readFileSync(join(dashboardRoot, "clients/[customerId]/page.tsx"), "utf8");
    const appointmentSource = readFileSync(join(dashboardRoot, "calendar/_components/AppointmentDetailPanel.tsx"), "utf8");

    expect(existsSync(detailPath)).toBe(true);
    expect(documentsSource).toContain("Crea nuova versione");
    expect(customerSource).toContain("Consensi del cliente");
    expect(appointmentSource).toContain("Richiedi consenso");
  });

  it("builds an appointment-scoped list query without unrelated fields", () => {
    expect(buildConsentFilters("customer-1", "appointment-1")).toBe(
      "customer_id=customer-1&appointment_id=appointment-1",
    );
    expect(buildConsentFilters("customer-1")).toBe("customer_id=customer-1");
  });

  it("builds the API request body with a future ISO expiry", () => {
    const body = buildConsentRequestBody({
      appointmentId: "appointment-1",
      customerId: "customer-1",
      deliveryChannel: "email",
      expiresAt: "2026-09-01T12:00:00.000Z",
      templateId: "template-1",
    });

    expect(body).toEqual({
      appointment_id: "appointment-1",
      customer_id: "customer-1",
      delivery_channel: "email",
      expires_at: "2026-09-01T12:00:00.000Z",
      template_id: "template-1",
    });
  });

  it("turns the server path into a usable PWA link without moving the token to a query", () => {
    expect(buildSigningHref("/consents/v1.secret", "https://client.example.test")).toBe("https://client.example.test/consents/v1.secret");
    expect(buildSigningHref("/consents/v1.secret", "")).toBe("/consents/v1.secret");
    expect(new URL(buildSigningHref("/consents/v1.secret", "https://client.example.test")).search).toBe("");
  });

  it("wires the public PWA origin into dashboard production builds", () => {
    const workspaceRoot = resolve(process.cwd(), "../..");
    expect(readFileSync(join(process.cwd(), "Dockerfile"), "utf8")).toContain("NEXT_PUBLIC_PWA_URL");
    expect(readFileSync(join(workspaceRoot, "compose.yaml"), "utf8")).toContain("NEXT_PUBLIC_PWA_URL:");
    expect(readFileSync(join(workspaceRoot, ".env.example"), "utf8")).toContain("NEXT_PUBLIC_PWA_URL=");
  });

  it("presents every durable consent status distinctly", () => {
    expect(consentStatusPresentation("pending")).toEqual({ label: "In attesa", badge: "waiting" });
    expect(consentStatusPresentation("signed")).toEqual({ label: "Firmato", badge: "active" });
    expect(consentStatusPresentation("expired")).toEqual({ label: "Scaduto", badge: "inactive" });
    expect(consentStatusPresentation("revoked")).toEqual({ label: "Revocato", badge: "archived" });
  });

  it("maps stable lifecycle errors to actionable operator guidance", () => {
    expect(consentMutationError("TOKEN_EXPIRED")).toBe("La richiesta è scaduta. Rigenera il link per continuare.");
    expect(consentMutationError("CONSENT_EVIDENCE_TAMPERED")).toBe("L'evidenza non supera la verifica di integrità.");
    expect(consentMutationError("UNKNOWN_ERROR")).toBe("Operazione non riuscita. Riprova.");
  });

  it("uses a seven-day default expiry without mutating the supplied date", () => {
    const now = new Date("2026-08-24T10:30:00.000Z");
    expect(nextConsentExpiry(now)).toBe("2026-08-31T10:30");
    expect(now.toISOString()).toBe("2026-08-24T10:30:00.000Z");
  });
});
