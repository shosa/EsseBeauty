import { describe, expect, it } from "vitest";

import {
  buildPublicReviewPath,
  initialReviewSubmissionState,
  publicReviewErrorMessage,
  reviewSubmissionReducer,
} from "./app/review/review-submission.js";
import { reviewNetworkOnly, reviewRouteHeaders } from "./lib/cache-policy.mjs";

describe("public review submission", () => {
  it("keeps the token encoded in the path and out of query/referrer data", () => {
    const path = buildPublicReviewPath("https://api.example.test/", "v1.review/secret?query");
    expect(path).toBe("https://api.example.test/api/public/reviews/token/v1.review%2Fsecret%3Fquery");
    expect(new URL(path).search).toBe("");
    expect(reviewRouteHeaders).toEqual([{
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      source: "/review/:token",
    }]);
    expect(reviewNetworkOnly.urlPattern.test("https://pwa.example.test/review/v1.review.secret")).toBe(true);
  });

  it("preserves rating and comment after a submission failure", () => {
    let state = reviewSubmissionReducer(initialReviewSubmissionState, { rating: 5, type: "rating" });
    state = reviewSubmissionReducer(state, { comment: "Esperienza ottima", type: "comment" });
    state = reviewSubmissionReducer(state, { type: "submit" });
    state = reviewSubmissionReducer(state, { error: "Riprova.", type: "failure" });
    expect(state).toMatchObject({ comment: "Esperienza ottima", error: "Riprova.", rating: 5, submitted: false, submitting: false });
  });

  it("explains distinct review invitation lifecycle failures", () => {
    expect(publicReviewErrorMessage("TOKEN_EXPIRED")).toContain("scaduto");
    expect(publicReviewErrorMessage("TOKEN_CONSUMED")).toContain("già");
    expect(publicReviewErrorMessage("TOKEN_REVOKED")).toContain("revocato");
    expect(publicReviewErrorMessage("TOKEN_INVALID")).toContain("valido");
  });
});
