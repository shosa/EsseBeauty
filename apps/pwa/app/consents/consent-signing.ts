export function buildPublicConsentPath(
  apiBaseUrl: string,
  token: string,
  action?: "sign",
): string {
  const base = apiBaseUrl.replace(/\/$/, "");
  const path = `${base}/api/public/consents/${encodeURIComponent(token)}`;
  return action === "sign" ? `${path}/sign` : path;
}

export function buildTypedSignaturePayload(signerName: string) {
  const value = signerName.trim();
  return {
    accepted: true as const,
    signature: { type: "typed" as const, value },
    signer_name: value,
  };
}

export function publicConsentErrorMessage(code?: string): string {
  const messages: Record<string, string> = {
    TOKEN_CONSUMED: "Questo documento è già stato firmato.",
    TOKEN_EXPIRED: "Questo link è scaduto. Chiedi al salone un nuovo invito.",
    TOKEN_INVALID: "Il link non è valido o non è più disponibile.",
    TOKEN_REVOKED: "Questo consenso è stato revocato.",
  };
  return code && messages[code] ? messages[code] : "Non è stato possibile caricare il documento.";
}

export interface PublicConsentView {
  consent: {
    body: string;
    expires_at: string | null;
    id: string;
    name: string;
    status: "pending";
    type: string;
    version: number;
  };
  salon: { name: string };
}

export interface PublicSigningState {
  accepted: boolean;
  error: string;
  signed: boolean;
  signerName: string;
  submitting: boolean;
}

type PublicSigningAction =
  | { field: "accepted"; type: "change"; value: boolean }
  | { field: "signerName"; type: "change"; value: string }
  | { type: "submit" }
  | { error: string; type: "failure" }
  | { type: "success" };

export const initialPublicSigningState: PublicSigningState = {
  accepted: false,
  error: "",
  signed: false,
  signerName: "",
  submitting: false,
};

export function publicSigningReducer(
  state: PublicSigningState,
  action: PublicSigningAction,
): PublicSigningState {
  switch (action.type) {
    case "change":
      return { ...state, [action.field]: action.value };
    case "submit":
      return { ...state, error: "", submitting: true };
    case "failure":
      return { ...state, error: action.error, submitting: false };
    case "success":
      return { ...state, error: "", signed: true, submitting: false };
  }
}

export type PublicConsentLoadResult =
  | { documentView: PublicConsentView; ok: true }
  | { error: string; ok: false };

export async function loadPublicConsentView(
  fetcher: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<PublicConsentLoadResult> {
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
      return { error: publicConsentErrorMessage(body?.error), ok: false };
    }
    return { documentView: await response.json() as PublicConsentView, ok: true };
  } catch {
    return { error: publicConsentErrorMessage(), ok: false };
  }
}
