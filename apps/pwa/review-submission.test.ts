import { describe, expect, it } from "vitest";

import {
  buildReviewSessionPath,
  initialReviewSubmissionState,
  publicReviewErrorMessage,
  reviewSubmissionReducer,
} from "./app/review/review-submission.js";
import { reviewNetworkOnly, reviewRouteHeaders } from "./lib/cache-policy.mjs";

describe("public review submission", () => {
  it("uses a token-free same-origin session path after ingress exchange", () => {
    const path = buildReviewSessionPath("https://pwa.example.test/");
    expect(path).toBe("https://pwa.example.test/review/session");
    expect(new URL(path).search).toBe("");
    expect(reviewRouteHeaders).toEqual([{
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      source: "/review",
    }]);
    expect(reviewNetworkOnly.urlPattern.test("https://pwa.example.test/review")).toBe(true);
    expect(reviewNetworkOnly.urlPattern.test("https://pwa.example.test/review/session")).toBe(true);
    expect(reviewNetworkOnly.urlPattern.test("https://pwa.example.test/review/v1.review.secret")).toBe(false);
  });

  it("preserves rating and comment after a submission failure", () => {
    let state = reviewSubmissionReducer(initialReviewSubmissionState, { rating: 5, type: "rating" });
    state = reviewSubmissionReducer(state, { comment: "Esperienza ottima", type: "comment" });
    state = reviewSubmissionReducer(state, { type: "submit" });
    state = reviewSubmissionReducer(state, { error: "Riprova.", type: "failure" });
    expect(state).toMatchObject({ comment: "Esperienza ottima", error: "Riprova.", rating: 5, submitted: false, submitting: false });
  });

  it("clears old summary form state before a new invitation loads", () => {
    let state = reviewSubmissionReducer(initialReviewSubmissionState, { rating: 5, type: "rating" });
    state = reviewSubmissionReducer(state, { comment: "Vecchia recensione", type: "comment" });
    state = reviewSubmissionReducer(state, { type: "reset" });
    expect(state).toEqual(initialReviewSubmissionState);
  });

  it("explains distinct review invitation lifecycle failures", () => {
    expect(publicReviewErrorMessage("TOKEN_EXPIRED")).toContain("scaduto");
    expect(publicReviewErrorMessage("TOKEN_CONSUMED")).toContain("già");
    expect(publicReviewErrorMessage("TOKEN_REVOKED")).toContain("revocato");
    expect(publicReviewErrorMessage("TOKEN_INVALID")).toContain("valido");
  });
});
