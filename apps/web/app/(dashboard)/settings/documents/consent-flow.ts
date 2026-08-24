export type ConsentDeliveryChannel = "email" | "in_person" | "sms";
export type ConsentStatus = "expired" | "pending" | "revoked" | "signed";

export interface ConsentRequestInput {
  appointmentId?: string;
  customerId: string;
  deliveryChannel: ConsentDeliveryChannel;
  expiresAt: string;
  templateId: string;
}

export function buildConsentFilters(customerId: string, appointmentId?: string): string {
  const filters = new URLSearchParams({ customer_id: customerId });
  if (appointmentId) filters.set("appointment_id", appointmentId);
  return filters.toString();
}

export function buildConsentRequestBody(input: ConsentRequestInput) {
  return {
    ...(input.appointmentId ? { appointment_id: input.appointmentId } : {}),
    customer_id: input.customerId,
    delivery_channel: input.deliveryChannel,
    expires_at: input.expiresAt,
    template_id: input.templateId,
  };
}

export function buildSigningHref(path: string, pwaBaseUrl: string): string {
  return pwaBaseUrl ? new URL(path, pwaBaseUrl).toString() : path;
}

export function consentStatusPresentation(status: ConsentStatus): {
  badge: "active" | "archived" | "inactive" | "waiting";
  label: string;
} {
  const statuses = {
    expired: { badge: "inactive", label: "Scaduto" },
    pending: { badge: "waiting", label: "In attesa" },
    revoked: { badge: "archived", label: "Revocato" },
    signed: { badge: "active", label: "Firmato" },
  } as const;
  return statuses[status];
}

export function nextConsentExpiry(now = new Date()): string {
  return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 16);
}

export function consentMutationError(code?: string): string {
  const messages: Record<string, string> = {
    CONSENT_ALREADY_REVOKED: "Il consenso è già stato revocato.",
    CONSENT_APPOINTMENT_INVALID: "L'appuntamento non appartiene a questo cliente.",
    CONSENT_CUSTOMER_INVALID: "Il cliente non è disponibile.",
    CONSENT_EVIDENCE_TAMPERED: "L'evidenza non supera la verifica di integrità.",
    CONSENT_NOT_SIGNED: "Il documento non è ancora stato firmato.",
    CONSENT_REQUEST_NOT_FOUND: "La richiesta non è più disponibile.",
    CONSENT_SERVICE_INVALID: "Il modello non è valido per il servizio selezionato.",
    CONSENT_TEMPLATE_ARCHIVED: "Il modello selezionato è archiviato.",
    CONSENT_TEMPLATE_NOT_FOUND: "Il modello selezionato non è più disponibile.",
    TOKEN_CONSUMED: "Il documento è già stato firmato.",
    TOKEN_EXPIRED: "La richiesta è scaduta. Rigenera il link per continuare.",
    TOKEN_REVOKED: "Il consenso è stato revocato.",
  };
  return code && messages[code] ? messages[code] : "Operazione non riuscita. Riprova.";
}
