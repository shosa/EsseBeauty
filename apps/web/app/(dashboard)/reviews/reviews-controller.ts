export interface ReviewItem {
  comment?: string;
  created_at: string;
  customer_name: string;
  id: string;
  published: boolean;
  rating: number;
  reply?: string;
}

export interface ReviewMutationState {
  error: string;
  pending: boolean;
  reply: string;
  selected?: ReviewItem;
}

export type ReviewMutationAction =
  | { review: ReviewItem; type: "open" }
  | { type: "changeReply"; value: string }
  | { type: "begin" }
  | { error: string; type: "failure" }
  | { type: "mutationSuccess" }
  | { type: "replySuccess" }
  | { type: "close" };

export const initialReviewMutationState: ReviewMutationState = {
  error: "",
  pending: false,
  reply: "",
};

export function reviewMutationReducer(
  state: ReviewMutationState,
  action: ReviewMutationAction,
): ReviewMutationState {
  switch (action.type) {
    case "open":
      return { error: "", pending: false, reply: action.review.reply ?? "", selected: action.review };
    case "changeReply":
      return { ...state, reply: action.value };
    case "begin":
      return { ...state, error: "", pending: true };
    case "failure":
      return { ...state, error: action.error, pending: false };
    case "mutationSuccess":
      return { ...state, error: "", pending: false };
    case "replySuccess":
    case "close":
      return initialReviewMutationState;
  }
}

function mutationErrorMessage(code?: string): string {
  if (code === "PERMISSION_DENIED" || code === "FORBIDDEN") {
    return "Non hai i permessi per modificare questa recensione.";
  }
  if (code === "REVIEW_NOT_FOUND") return "La recensione non è più disponibile.";
  return "Salvataggio non riuscito. Controlla la connessione e riprova.";
}

export async function requestReviewMutation(
  fetcher: typeof fetch,
  url: string,
  payload: Record<string, unknown>,
): Promise<void> {
  let response: Response;
  try {
    response = await fetcher(url, {
      body: JSON.stringify(payload),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "PATCH",
    });
  } catch {
    throw new Error(mutationErrorMessage());
  }
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(mutationErrorMessage(body?.error));
  }
}
