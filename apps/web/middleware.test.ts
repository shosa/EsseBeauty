import { describe, expect, it } from "vitest";

import { middleware } from "./middleware.js";

describe("dashboard middleware", () => {
  it("delegates authentication to the API-backed AuthProvider", () => {
    const response = middleware();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
