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
