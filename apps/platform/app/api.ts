const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export function apiBaseUrl(): string {
  if (typeof window === "undefined" || !configuredApiUrl) return configuredApiUrl;
  const configured = new URL(configuredApiUrl);
  if (["localhost", "127.0.0.1"].includes(configured.hostname) && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    configured.hostname = window.location.hostname;
  }
  return configured.origin;
}

const messages: Record<string, string> = {
  BOOTSTRAP_ALREADY_COMPLETED: "La configurazione iniziale è già stata completata.",
  INVALID_CREDENTIALS: "Email o password non corrette.",
  INVALID_MODULE_KEY: "Modulo non valido.",
  NAME_REQUIRED: "Inserisci il nome del salone.",
  OWNER_NOT_FOUND: "Il titolare non è disponibile.",
  OWNER_REQUIRED: "Completa i dati del titolare.",
  PASSWORD_TOO_SHORT: "La password deve contenere almeno 10 caratteri.",
  PLAN_REQUIRED: "Nome e codice del piano sono obbligatori.",
  SALON_CONFIRMATION_MISMATCH: "La conferma non coincide con lo slug del salone.",
  SALON_NOT_FOUND: "Il salone non esiste più.",
  UNAUTHENTICATED: "La sessione Platform è scaduta.",
};

export async function platformRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const code = typeof body.error === "string" ? body.error : "REQUEST_FAILED";
    throw new Error(messages[code] ?? "Operazione non riuscita. Riprova.");
  }
  return response.json() as Promise<T>;
}
