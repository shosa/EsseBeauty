import { describe, expect, it, vi } from "vitest";

import { parseBody, type SafeParseSchema } from "./http-validation.js";

describe("parseBody", () => {
  it("returns field details instead of invoking a handler with malformed input", () => {
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const schema: SafeParseSchema<{ email: string }> = {
      safeParse: () => ({
        error: { fieldErrors: { email: ["Email obbligatoria"] } },
        success: false,
      }),
    };

    const body = parseBody(schema, { body: {} }, reply as never);

    expect(body).toBeUndefined();
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: "INVALID_REQUEST",
      fields: { email: ["Email obbligatoria"] },
    });
  });
});
