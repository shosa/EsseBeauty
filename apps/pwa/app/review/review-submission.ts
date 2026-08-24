export interface PublicReviewView {
  salon_name: string;
  service_name: string;
  starts_at: string;
}

export interface ReviewSubmissionState {
  comment: string;
  error: string;
  rating: number;
  submitted: boolean;
  submitting: boolean;
}

type ReviewSubmissionAction =
  | { rating: number; type: "rating" }
  | { comment: string; type: "comment" }
  | { type: "submit" }
  | { type: "reset" }
  | { error: string; type: "failure" }
  | { type: "success" };

export const initialReviewSubmissionState: ReviewSubmissionState = {
  comment: "",
  error: "",
  rating: 0,
  submitted: false,
  submitting: false,
};

export function reviewSubmissionReducer(
  state: ReviewSubmissionState,
  action: ReviewSubmissionAction,
): ReviewSubmissionState {
  switch (action.type) {
    case "reset": return initialReviewSubmissionState;
    case "rating": return { ...state, rating: action.rating };
    case "comment": return { ...state, comment: action.comment };
    case "submit": return { ...state, error: "", submitting: true };
    case "failure": return { ...state, error: action.error, submitting: false };
    case "success": return { ...state, error: "", submitted: true, submitting: false };
  }
}

export function buildReviewSessionPath(pwaBaseUrl = ""): string {
  if (!pwaBaseUrl) return "/review/session";
  return new URL("/review/session", pwaBaseUrl).toString().replace(/\/$/, "");
}

export function publicReviewErrorMessage(code?: string): string {
  const messages: Record<string, string> = {
    TOKEN_CONSUMED: "Questa recensione è già stata inviata.",
    TOKEN_EXPIRED: "Questo link è scaduto. Contatta il salone per assistenza.",
    TOKEN_INVALID: "Il link non è valido o non è più disponibile.",
    TOKEN_REVOKED: "Questo invito è stato revocato dal salone.",
  };
  return code && messages[code] ? messages[code] : "Operazione non riuscita. Controlla la connessione e riprova.";
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
  return publicReviewErrorMessage(body?.error);
}

export async function loadPublicReview(
  fetcher: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<{ error: string; ok: false } | { ok: true; view: PublicReviewView }> {
  try {
    const response = await fetcher(url, { cache: "no-store", referrerPolicy: "no-referrer", signal });
    if (!response.ok) return { error: await responseError(response), ok: false };
    return { ok: true, view: await response.json() as PublicReviewView };
  } catch {
    return { error: publicReviewErrorMessage(), ok: false };
  }
}

export async function submitPublicReview(
  fetcher: typeof fetch,
  url: string,
  payload: { comment?: string; rating: number },
): Promise<{ error: string; ok: false } | { ok: true }> {
  try {
    const response = await fetcher(url, {
      body: JSON.stringify(payload),
      cache: "no-store",
      headers: { "content-type": "application/json" },
      method: "POST",
      referrerPolicy: "no-referrer",
    });
    return response.ok ? { ok: true } : { error: await responseError(response), ok: false };
  } catch {
    return { error: publicReviewErrorMessage(), ok: false };
  }
}
