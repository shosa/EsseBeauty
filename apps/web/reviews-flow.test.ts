import { describe, expect, it } from "vitest";

import {
  initialReviewMutationState,
  requestReviewMutation,
  reviewMutationReducer,
} from "./app/(dashboard)/reviews/reviews-controller.js";

const review = {
  comment: "Ottimo",
  created_at: "2026-08-24T08:00:00.000Z",
  customer_name: "Mario Rossi",
  id: "review-1",
  published: false,
  rating: 5,
  reply: "",
};

describe("review dashboard management", () => {
  it("keeps the reply dialog and edited reply open when saving fails", () => {
    let state = reviewMutationReducer(initialReviewMutationState, { review, type: "open" });
    state = reviewMutationReducer(state, { type: "changeReply", value: "Grazie Mario" });
    state = reviewMutationReducer(state, { type: "begin" });
    state = reviewMutationReducer(state, { error: "Salvataggio non riuscito.", type: "failure" });

    expect(state).toEqual({
      error: "Salvataggio non riuscito.",
      pending: false,
      reply: "Grazie Mario",
      selected: review,
    });
  });

  it("closes the reply dialog only after a successful mutation", () => {
    let state = reviewMutationReducer(initialReviewMutationState, { review, type: "open" });
    state = reviewMutationReducer(state, { type: "begin" });
    state = reviewMutationReducer(state, { type: "replySuccess" });
    expect(state).toEqual(initialReviewMutationState);
  });

  it("turns non-success API responses into visible mutation errors", async () => {
    await expect(requestReviewMutation(
      async () => new Response(JSON.stringify({ error: "PERMISSION_DENIED" }), { status: 403 }),
      "https://api.example.test/reviews/review-1/publish",
      { published: true },
    )).rejects.toThrow("Non hai i permessi per modificare questa recensione.");
  });
});
