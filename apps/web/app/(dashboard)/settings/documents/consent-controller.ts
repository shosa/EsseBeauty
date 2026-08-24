import { consentMutationError, type ConsentDeliveryChannel, type ConsentStatus } from "./consent-flow";

export interface ConsentTemplateOption {
  id: string;
  name: string;
  required_for_services: string[];
  type: string;
  version: number;
}

export interface CustomerConsentRecord {
  appointment_id: string | null;
  created_at: string;
  customer_id: string;
  delivery_channel: ConsentDeliveryChannel | null;
  document_hash: string | null;
  expires_at: string | null;
  id: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  signed_at: string | null;
  signer_name: string | null;
  status: ConsentStatus;
  template_id: string;
  template_name: string;
  template_version: number;
}

export type ConsentDialogMode = "request" | "resend" | "revoke" | "sign";

export interface ConsentDialogState {
  accepted: boolean;
  deliveryChannel: ConsentDeliveryChannel;
  error: string;
  expiresAt: string;
  mode?: ConsentDialogMode;
  revocationReason: string;
  signerName: string;
  templateId: string;
}

type ConsentDialogAction =
  | { expiresAt: string; templateId: string; type: "open_request" }
  | { deliveryChannel: ConsentDeliveryChannel; expiresAt: string; type: "open_resend" }
  | { type: "open_sign" }
  | { type: "open_revoke" }
  | { field: "accepted"; type: "change"; value: boolean }
  | { field: "deliveryChannel"; type: "change"; value: ConsentDeliveryChannel }
  | { field: "expiresAt" | "revocationReason" | "signerName" | "templateId"; type: "change"; value: string }
  | { error: string; type: "failure" }
  | { type: "close" | "success" };

export function initialConsentDialogState(expiresAt: string): ConsentDialogState {
  return {
    accepted: false,
    deliveryChannel: "in_person",
    error: "",
    expiresAt,
    revocationReason: "",
    signerName: "",
    templateId: "",
  };
}

export function consentDialogReducer(
  state: ConsentDialogState,
  action: ConsentDialogAction,
): ConsentDialogState {
  switch (action.type) {
    case "open_request":
      return { ...initialConsentDialogState(action.expiresAt), mode: "request", templateId: action.templateId };
    case "open_resend":
      return { ...initialConsentDialogState(action.expiresAt), deliveryChannel: action.deliveryChannel, mode: "resend" };
    case "open_sign":
      return { ...initialConsentDialogState(state.expiresAt), mode: "sign" };
    case "open_revoke":
      return { ...initialConsentDialogState(state.expiresAt), mode: "revoke" };
    case "change":
      return { ...state, [action.field]: action.value };
    case "failure":
      return { ...state, error: action.error };
    case "close":
    case "success":
      return initialConsentDialogState(state.expiresAt);
  }
}

export type ConsentLoadResult =
  | { consents: CustomerConsentRecord[]; ok: true; templates: ConsentTemplateOption[] }
  | { error: string; ok: false };

export async function loadConsentRecords(
  fetcher: typeof fetch,
  consentUrl: string,
  templateOptionsUrl?: string,
): Promise<ConsentLoadResult> {
  try {
    const consentResponse = await fetcher(consentUrl, { credentials: "include" });
    if (!consentResponse.ok) return { error: "Consensi non disponibili.", ok: false };
    const consents = await consentResponse.json() as CustomerConsentRecord[];
    if (!templateOptionsUrl) return { consents, ok: true, templates: [] };
    const optionsResponse = await fetcher(templateOptionsUrl, { credentials: "include" });
    if (!optionsResponse.ok) return { error: "Modelli di consenso non disponibili.", ok: false };
    return {
      consents,
      ok: true,
      templates: await optionsResponse.json() as ConsentTemplateOption[],
    };
  } catch {
    return { error: "Consensi non disponibili.", ok: false };
  }
}

export async function downloadEvidenceRecord({
  fetcher,
  filename,
  save,
  url,
}: {
  fetcher: typeof fetch;
  filename: string;
  save(blob: Blob, filename: string): void;
  url: string;
}): Promise<string> {
  try {
    const response = await fetcher(url, { credentials: "include" });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
      return consentMutationError(body?.error);
    }
    save(await response.blob(), filename);
    return "";
  } catch {
    return "Evidenza non disponibile. Controlla la connessione e riprova.";
  }
}

export async function copySigningLink(
  clipboard: Pick<Clipboard, "writeText">,
  href: string,
): Promise<{ copied: boolean; error: string }> {
  try {
    await clipboard.writeText(href);
    return { copied: true, error: "" };
  } catch {
    return {
      copied: false,
      error: "Impossibile copiare il link. Selezionalo e copialo manualmente.",
    };
  }
}
